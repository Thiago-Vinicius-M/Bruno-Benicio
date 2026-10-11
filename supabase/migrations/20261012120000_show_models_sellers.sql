-- =============================================================================
-- Modelos de show (seção NOSSO SHOW) e vendedores (links comerciais com retorno
-- ao WhatsApp), editados pelo painel
--
--   * show_models → formatos com preço exibidos em "Nosso show". active = false tira
--                   o modelo do site sem apagá-lo (pode ser reativado). Ordem por
--                   position, trocada por move_show_model(id, 'up'|'down').
--   * sellers     → contatos comerciais (não são usuários do painel). Cada um tem um
--                   código aleatório e imutável usado no link /r/<code>; o telefone
--                   nunca aparece no link. active = false invalida o link sem apagá-lo.
--   * Site público lê somente get_public_show_models() (só ativos, sem auditoria) e
--     get_seller_link(code) (só o status e, se ativo, o WhatsApp daquele código).
--     anon não acessa as tabelas.
--   * Preços e telefones comerciais são dados de negócio: como Usuários e Financeiro,
--     só ADMIN ativo lê e edita (EDITOR não tem acesso). Sem exclusão física.
--   * Mesmas convenções da Agenda e dos Vídeos: auditoria por trigger a partir de
--     auth.uid(); valores de auditoria enviados pelo cliente são descartados.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tabelas
-- -----------------------------------------------------------------------------

create table public.show_models (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  -- Linha abaixo do nome no site (ex.: "2h30 de show").
  duration    text not null,
  -- Texto opcional exibido abaixo da duração.
  description text,
  -- Em reais.
  price       numeric(10, 2) not null,
  active      boolean not null default true,
  -- Default só para os tipos gerados tratarem como opcional; o trigger define a posição.
  position    integer not null default 0,
  -- Nulos apenas nos modelos importados por esta migration (antes do painel).
  created_by  uuid references public.profiles (id) on delete restrict,
  updated_by  uuid references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint show_models_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint show_models_duration_length check (char_length(btrim(duration)) between 1 and 60),
  constraint show_models_description_length check (description is null or char_length(description) between 1 and 280),
  constraint show_models_price_positive check (price > 0),
  constraint show_models_position_unique unique (position) deferrable initially deferred,
  constraint show_models_timestamps check (updated_at >= created_at)
);

-- O nome vai na mensagem do WhatsApp: dois modelos com o mesmo nome confundiriam a negociação.
create unique index show_models_name_key on public.show_models (lower(name));

comment on table public.show_models is
  'Formatos de show da seção NOSSO SHOW. Só os ativos aparecem no site, na ordem de position.';
comment on column public.show_models.price is 'Valor em reais exibido no site e enviado na mensagem do WhatsApp.';

create table public.sellers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  -- Formato internacional, só dígitos: DDI + DDD + número (ex.: 5562999999999).
  whatsapp    text not null,
  -- Código público do link (/r/<code>). Gerado pelo trigger e imutável.
  code        text not null default '',
  active      boolean not null default true,
  created_by  uuid references public.profiles (id) on delete restrict,
  updated_by  uuid references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint sellers_name_length check (char_length(btrim(name)) between 1 and 80),
  -- E.164 sem o "+": 10 a 15 dígitos, sem zero à esquerda.
  constraint sellers_whatsapp_format check (whatsapp ~ '^[1-9][0-9]{9,14}$'),
  -- Brasil (55): DDD sem zero + fixo de 8 dígitos (2-5) ou celular de 9 dígitos (9).
  constraint sellers_whatsapp_brazil check (
    whatsapp !~ '^55' or whatsapp ~ '^55[1-9][1-9]([2-5][0-9]{7}|9[0-9]{8})$'
  ),
  constraint sellers_code_format check (code ~ '^[a-z0-9]{8,32}$'),
  constraint sellers_code_key unique (code),
  constraint sellers_timestamps check (updated_at >= created_at)
);

comment on table public.sellers is
  'Vendedores (contatos comerciais, não usuários do painel). O link /r/<code> leva ao site e o botão "Voltar ao WhatsApp" abre a conversa com este número.';
comment on column public.sellers.code is 'Identificador público do link comercial. Aleatório, gerado pelo banco e imutável.';


-- -----------------------------------------------------------------------------
-- 2. Funções
-- -----------------------------------------------------------------------------

-- Site público: somente modelos ativos e só o que a seção exibe, na ordem de exibição.
create function public.get_public_show_models()
returns table (
  id          uuid,
  name        text,
  duration    text,
  description text,
  price       numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.name, m.duration, m.description, m.price
  from public.show_models m
  where m.active
  order by m.position, m.created_at, m.id
$$;

-- Link comercial: status do vendedor daquele código. O WhatsApp só é devolvido se ele
-- estiver ativo. Código inexistente → nenhuma linha. Nada além disso é exposto
-- (nome, outros vendedores, auditoria).
create function public.get_seller_link(p_code text)
returns table (
  active   boolean,
  whatsapp text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.active, case when s.active then s.whatsapp end
  from public.sellers s
  where s.code = lower(btrim(p_code))
$$;

-- Sobe/desce um modelo uma posição na ordem de exibição.
-- SECURITY INVOKER: o RLS de show_models vale normalmente (só ADMIN enxerga e edita).
create function public.move_show_model(p_id uuid, p_direction text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_model    public.show_models;
  v_neighbor public.show_models;
begin
  if p_direction is null or p_direction not in ('up', 'down') then
    raise exception 'Direção inválida: use up ou down.' using errcode = '22023';
  end if;

  select * into v_model from public.show_models where id = p_id for update;
  if not found then
    raise exception 'Modelo de show não encontrado.' using errcode = '22023';
  end if;

  if p_direction = 'up' then
    select * into v_neighbor from public.show_models
    where position < v_model.position
    order by position desc limit 1 for update;
  else
    select * into v_neighbor from public.show_models
    where position > v_model.position
    order by position limit 1 for update;
  end if;

  -- Já é o primeiro/último: nada a fazer.
  if not found then
    return;
  end if;

  -- A unicidade de position é verificada no fim da transação (deferrable).
  update public.show_models set position = v_neighbor.position where id = v_model.id;
  update public.show_models set position = v_model.position where id = v_neighbor.id;
end;
$$;

-- Código aleatório do link: 12 caracteres hexadecimais (48 bits) da parte aleatória
-- de um UUID v4. Não depende do nome nem do telefone.
create function private.new_seller_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    exit when not exists (select 1 from public.sellers s where s.code = v_code);
  end loop;
  return v_code;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. Triggers (auditoria, posição e código do link)
-- -----------------------------------------------------------------------------

create function private.show_models_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid     uuid    := auth.uid();
  v_trusted boolean := private.is_trusted_caller();
begin
  if not v_trusted and v_uid is null then
    raise exception 'Operação exige usuário autenticado.' using errcode = '42501';
  end if;

  new.name        := btrim(new.name);
  new.duration    := btrim(new.duration);
  new.description := nullif(btrim(new.description), '');

  if tg_op = 'INSERT' then
    -- Novo modelo entra no fim da lista.
    new.position   := coalesce((select max(m.position) from public.show_models m), 0) + 1;
    new.created_at := now();
    new.updated_at := now();
    if v_trusted then
      new.updated_by := coalesce(new.updated_by, new.created_by);
    else
      new.created_by := v_uid;
      new.updated_by := v_uid;
    end if;
    return new;
  end if;

  -- UPDATE
  new.id         := old.id;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := case when v_trusted then coalesce(new.updated_by, old.updated_by) else v_uid end;
  return new;
end;
$$;

create function private.sellers_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid     uuid    := auth.uid();
  v_trusted boolean := private.is_trusted_caller();
begin
  if not v_trusted and v_uid is null then
    raise exception 'Operação exige usuário autenticado.' using errcode = '42501';
  end if;

  new.name := btrim(new.name);

  if tg_op = 'INSERT' then
    -- O código sempre vem do banco (o SQL Editor pode informar um, para migrações).
    if not v_trusted or coalesce(new.code, '') = '' then
      new.code := private.new_seller_code();
    end if;
    new.created_at := now();
    new.updated_at := now();
    if v_trusted then
      new.updated_by := coalesce(new.updated_by, new.created_by);
    else
      new.created_by := v_uid;
      new.updated_by := v_uid;
    end if;
    return new;
  end if;

  -- UPDATE: o link já compartilhado continua valendo (código imutável).
  new.id         := old.id;
  new.code       := old.code;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := case when v_trusted then coalesce(new.updated_by, old.updated_by) else v_uid end;
  return new;
end;
$$;

create trigger show_models_before_write
  before insert or update on public.show_models
  for each row execute function private.show_models_before_write();

create trigger sellers_before_write
  before insert or update on public.sellers
  for each row execute function private.sellers_before_write();


-- -----------------------------------------------------------------------------
-- 4. Privilégios e RLS
-- -----------------------------------------------------------------------------

alter table public.show_models enable row level security;
alter table public.sellers     enable row level security;

revoke all on public.show_models, public.sellers from anon;
revoke truncate, references, trigger on public.show_models, public.sellers from authenticated;
-- Sem exclusão física: desativar preserva o histórico e permite reativar.
revoke delete on public.show_models, public.sellers from authenticated;

revoke execute on function public.get_public_show_models() from public;
grant execute on function public.get_public_show_models() to anon, authenticated, service_role;

revoke execute on function public.get_seller_link(text) from public;
grant execute on function public.get_seller_link(text) to anon, authenticated, service_role;

revoke execute on function public.move_show_model(uuid, text) from public, anon;
grant execute on function public.move_show_model(uuid, text) to authenticated, service_role;

revoke execute on function
  private.new_seller_code(),
  private.show_models_before_write(),
  private.sellers_before_write()
from public, anon;
-- Chamada pelo trigger de sellers com o papel de quem escreve (schema private não é exposto pela API).
grant execute on function private.new_seller_code() to authenticated, service_role;

create policy "show_models: ADMIN lê"
  on public.show_models for select to authenticated
  using ((select private.is_admin()));

create policy "show_models: ADMIN cria"
  on public.show_models for insert to authenticated
  with check ((select private.is_admin()));

create policy "show_models: ADMIN edita"
  on public.show_models for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "sellers: ADMIN lê"
  on public.sellers for select to authenticated
  using ((select private.is_admin()));

create policy "sellers: ADMIN cria"
  on public.sellers for insert to authenticated
  with check ((select private.is_admin()));

create policy "sellers: ADMIN edita"
  on public.sellers for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));


-- -----------------------------------------------------------------------------
-- 5. Modelos que já estavam no site (antes em components/Show/showContent.ts)
-- -----------------------------------------------------------------------------
-- Idempotente pelo nome: rodar de novo não duplica nem altera o que o painel editou.

insert into public.show_models (name, duration, price)
select seed.name, seed.duration, seed.price
from (values
  (1, 'Voz e violão', '2h30 de show', 1500.00),
  (2, 'Voz, violão e bateria', '2h30 de show', 1800.00),
  (3, 'Voz, violão, sanfona e bateria', '2h30 de show', 2200.00),
  (4, 'Bruno e Benício e banda', '2h30 de show', 3000.00)
) as seed (ord, name, duration, price)
where not exists (select 1 from public.show_models m where lower(m.name) = lower(seed.name))
order by seed.ord;
