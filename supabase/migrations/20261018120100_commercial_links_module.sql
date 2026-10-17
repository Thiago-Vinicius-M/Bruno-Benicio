-- =============================================================================
-- Links comerciais como módulo próprio: vendedores com conta + canais de WhatsApp
--
--   Papéis (depois de 20261018120000_seller_role.sql)
--   * ADMIN  → tudo o que já podia + administra os canais de WhatsApp e vê todos os links.
--   * EDITOR → Agenda e Vídeos, como antes. NÃO cria links (já não criava).
--   * SELLER → só os próprios links comerciais. private.is_staff() passa a ser
--     "ADMIN ou EDITOR": o vendedor não lê nem altera agenda, vídeos, storage, configurações
--     do site, nomes da equipe nem nada que era de "staff".
--
--   Canais de WhatsApp (whatsapp_channels)
--   * Cada usuário (ADMIN ou SELLER) pode ter vários números, cada um com identificação,
--     situação (ativo/inativo) e, opcionalmente, um principal (só ordena a lista; a escolha
--     na criação do link continua obrigatória).
--   * Somente ADMIN cadastra e altera canais; o dono só os lê. Número e dono não mudam (outro
--     número = novo canal) e nada é apagado: desativa-se (AG008).
--   * Canal desativado (ou dono desativado): os links que o usam deixam de mandar contatos
--     para ele. O ADMIN pode apontar o canal desativado para outro canal ativo
--     (redirect_channel_id): os links continuam funcionando, com o número novo. O número e a
--     identificação gravados no link nunca mudam (histórico).
--
--   Criação de links (create_commercial_link)
--   * Só ADMIN ou SELLER ativos; só com um canal ATIVO do próprio usuário (o cliente informa
--     o id, o banco confere dono e situação e grava o número a partir do canal, nunca de
--     parâmetro).
--   * Um ou mais modelos ativos. Sem preço informado → preço padrão (show_models.price).
--     Preço diferente do padrão só com permissão: ADMIN ou profiles.can_customize_link_prices
--     (falso por padrão; ligado pelo SQL Editor). O preço padrão nunca muda.
--   * O link guarda o canal, o número e a identificação do canal, os modelos, o preço
--     ofertado e o padrão da época. Tudo imutável (só a desativação), como antes.
--
--   Compatibilidade
--   * Links permanentes (sellers.code) e temporários antigos (seller_links.seller_id)
--     continuam funcionando como antes. Os novos usam channel_id (seller_id nulo).
--   * create_seller_link(seller, ...) sai: só existe um jeito de criar link.
--   * Sem organizações nesta etapa (um único artista).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Papéis e permissões
-- -----------------------------------------------------------------------------

-- Antes: qualquer perfil ativo. Agora só a equipe da agenda e dos vídeos.
create or replace function private.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(private.current_app_role() in ('ADMIN', 'EDITOR'), false)
$$;

-- Quem cria e consulta (os próprios) links comerciais.
create function private.can_create_links()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(private.current_app_role() in ('ADMIN', 'SELLER'), false)
$$;

alter table public.profiles
  add column can_customize_link_prices boolean not null default false;

comment on column public.profiles.can_customize_link_prices is
  'Vendedor pode ofertar, num link comercial, valores diferentes do preço padrão. ADMIN sempre pode. Alterado só pelo SQL Editor.';

-- SECURITY DEFINER para ler o próprio perfil sem depender do RLS. Só responde sobre auth.uid().
create function private.can_customize_link_prices()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'ADMIN' or (p.role = 'SELLER' and p.can_customize_link_prices)
     from public.profiles p
     where p.id = (select auth.uid()) and p.deactivated_at is null),
    false
  )
$$;

-- Para a interface: o que o usuário logado pode fazer no módulo (a regra fica só no banco).
create function public.get_commercial_link_permissions()
returns table (can_create boolean, can_customize_prices boolean)
language sql
stable
set search_path = ''
as $$
  select private.can_create_links(), private.can_create_links() and private.can_customize_link_prices()
$$;


-- -----------------------------------------------------------------------------
-- 2. Canais de WhatsApp
-- -----------------------------------------------------------------------------

-- Mesma regra de sellers.whatsapp: E.164 sem "+", e formato brasileiro quando DDI 55.
create function private.is_valid_whatsapp(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_value ~ '^[1-9][0-9]{9,14}$'
     and (p_value !~ '^55' or p_value ~ '^55[1-9][1-9]([2-5][0-9]{7}|9[0-9]{8})$')
$$;

create table public.whatsapp_channels (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references public.profiles (id) on delete restrict,
  -- Só dígitos: DDI + DDD + número. Imutável.
  whatsapp            text not null,
  -- Ex.: "Comercial", "Pessoal". Aparece só no painel.
  label               text not null,
  active              boolean not null default true,
  is_primary          boolean not null default false,
  -- Só em canal desativado: para onde vão os contatos dos links que usam este canal.
  redirect_channel_id uuid references public.whatsapp_channels (id) on delete restrict,
  created_by          uuid references public.profiles (id) on delete restrict,
  updated_by          uuid references public.profiles (id) on delete restrict,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint whatsapp_channels_whatsapp_format check (private.is_valid_whatsapp(whatsapp)),
  constraint whatsapp_channels_label_length check (char_length(label) between 1 and 60),
  constraint whatsapp_channels_owner_number_key unique (owner_id, whatsapp),
  constraint whatsapp_channels_primary_active check (not is_primary or active),
  constraint whatsapp_channels_redirect check (
    redirect_channel_id is null or (not active and redirect_channel_id <> id)
  ),
  constraint whatsapp_channels_timestamps check (updated_at >= created_at)
);

comment on table public.whatsapp_channels is
  'Números de WhatsApp autorizados de cada usuário (ADMIN/SELLER) para links comerciais. Cadastrados só por ADMIN; nunca apagados.';

-- No máximo um principal por usuário.
create unique index whatsapp_channels_one_primary on public.whatsapp_channels (owner_id) where is_primary;

-- O perfil pode ter canais (ativo, ADMIN ou SELLER)? SECURITY DEFINER porque o RLS de profiles
-- só mostra o próprio perfil (nem o ADMIN lê os outros). Devolve só um booleano.
create function private.is_channel_owner_profile(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_id and p.deactivated_at is null and p.role in ('ADMIN', 'SELLER')
  )
$$;

create function private.whatsapp_channels_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid     uuid    := auth.uid();
  v_trusted boolean := private.is_trusted_caller();
begin
  if tg_op = 'DELETE' then
    raise exception 'Canais de WhatsApp não podem ser apagados. Desative o canal.' using errcode = 'AG008';
  end if;

  if not v_trusted and v_uid is null then
    raise exception 'Operação exige usuário autenticado.' using errcode = '42501';
  end if;

  new.label := btrim(regexp_replace(coalesce(new.label, ''), '[[:space:]]+', ' ', 'g'));

  if tg_op = 'INSERT' then
    if not private.is_channel_owner_profile(new.owner_id) then
      raise exception 'O WhatsApp precisa pertencer a um usuário ativo com perfil de Administrador ou Vendedor.'
        using errcode = '22023';
    end if;
    if not v_trusted then
      new.created_at := now();
      new.updated_at := now();
      new.created_by := v_uid;
      new.updated_by := v_uid;
    end if;
  else
    if new.id is distinct from old.id
       or new.owner_id is distinct from old.owner_id
       or new.whatsapp is distinct from old.whatsapp then
      raise exception 'O número e o dono de um canal não mudam. Para outro número, cadastre um novo canal.'
        using errcode = 'AG008';
    end if;
    if not v_trusted then
      new.created_at := old.created_at;
      new.created_by := old.created_by;
      new.updated_at := now();
      new.updated_by := v_uid;
    end if;
  end if;

  -- Reativar desfaz o redirecionamento; inativo não é principal. (Redirecionar um canal
  -- ativo é recusado pela constraint whatsapp_channels_redirect.)
  if new.active and tg_op = 'UPDATE' and not old.active then
    new.redirect_channel_id := null;
  end if;
  if not new.active then
    new.is_primary := false;
  end if;

  if new.redirect_channel_id is not null and not exists (
    select 1
    from public.whatsapp_channels r
    where r.id = new.redirect_channel_id and r.id <> new.id and r.active
      and private.is_channel_owner_profile(r.owner_id)
  ) then
    raise exception 'Redirecione para um WhatsApp ativo de um usuário ativo.' using errcode = '22023';
  end if;

  -- Novo principal: o anterior do mesmo usuário deixa de ser.
  if new.is_primary and (tg_op = 'INSERT' or not old.is_primary) then
    update public.whatsapp_channels c
    set is_primary = false
    where c.owner_id = new.owner_id and c.is_primary and c.id <> new.id;
  end if;

  return new;
end;
$$;

create trigger whatsapp_channels_before_write
  before insert or update or delete on public.whatsapp_channels
  for each row execute function private.whatsapp_channels_before_write();

-- Painel (ADMIN): usuários que podem receber canais. Só id, nome e papel de perfis ativos.
create function public.get_whatsapp_channel_owners()
returns table (id uuid, name text, role public.app_role)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Somente ADMIN pode administrar os canais de WhatsApp.' using errcode = '42501';
  end if;
  return query
    select p.id, p.name, p.role
    from public.profiles p
    where p.deactivated_at is null and p.role in ('ADMIN', 'SELLER')
    order by p.name, p.id;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. Links: canal e destino gravados
-- -----------------------------------------------------------------------------

alter table public.seller_links
  alter column seller_id drop not null,
  add column channel_id    uuid references public.whatsapp_channels (id) on delete restrict,
  -- Cópia do canal no momento da criação (histórico; o canal pode mudar de nome depois).
  add column whatsapp      text,
  add column channel_label text,
  add constraint seller_links_destination check (
    -- Antigo: vendedor (sem conta), número lido do cadastro dele.
    (seller_id is not null and channel_id is null and whatsapp is null and channel_label is null)
    -- Novo: canal do usuário que criou, com o número e a identificação gravados.
    or (seller_id is null and channel_id is not null and channel_label is not null
        and whatsapp is not null and private.is_valid_whatsapp(whatsapp))
  );

comment on column public.seller_links.seller_id is
  'Links antigos (por vendedor sem conta). Os novos usam channel_id e created_by.';
comment on column public.seller_links.whatsapp is
  'Número do canal usado na criação. Imutável: o destino da proposta não muda com o cadastro.';

create index seller_links_created_by_idx on public.seller_links (created_by, created_at desc);
create index seller_links_channel_idx on public.seller_links (channel_id);

alter table public.seller_link_prices
  add column default_price numeric(10, 2),
  add constraint seller_link_prices_default_positive check (default_price is null or default_price > 0);

comment on column public.seller_link_prices.default_price is
  'Preço padrão do modelo quando o link foi criado (nulo nos links antigos). Só referência: o ofertado é price.';

-- Imutabilidade passa a cobrir os campos novos.
create or replace function private.seller_links_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid     uuid    := auth.uid();
  v_trusted boolean := private.is_trusted_caller();
begin
  if tg_op = 'DELETE' then
    raise exception 'Links comerciais não podem ser apagados. Desative o link para invalidá-lo.'
      using errcode = 'AG007';
  end if;

  if not v_trusted and v_uid is null then
    raise exception 'Operação exige usuário autenticado.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.label := nullif(btrim(new.label), '');
    if not v_trusted or coalesce(new.code, '') = '' then
      new.code := private.new_seller_link_code();
    end if;
    if not v_trusted then
      new.created_at := now();
      new.created_by := v_uid;
    end if;
    new.active         := true;
    new.deactivated_at := null;
    new.deactivated_by := null;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.seller_id is distinct from old.seller_id
     or new.channel_id is distinct from old.channel_id
     or new.whatsapp is distinct from old.whatsapp
     or new.channel_label is distinct from old.channel_label
     or new.code is distinct from old.code
     or new.label is distinct from old.label
     or new.expires_at is distinct from old.expires_at
     or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by
     or (new.active and not old.active) then
    raise exception 'Links comerciais não podem ser alterados. Para mudar valores ou validade, crie um novo link.'
      using errcode = 'AG007';
  end if;

  if old.active and not new.active then
    new.deactivated_at := now();
    new.deactivated_by := case when v_trusted then coalesce(new.deactivated_by, v_uid) else v_uid end;
  else
    new.deactivated_at := old.deactivated_at;
    new.deactivated_by := old.deactivated_by;
  end if;
  return new;
end;
$$;

-- Para onde vão os contatos de um link hoje (null = nenhum destino disponível):
--   antigo → número do vendedor, se ativo;
--   novo   → o número gravado, se o canal e o dono estão ativos; senão o canal de
--            redirecionamento definido pelo ADMIN, se ele e o dono estão ativos.
create function private.link_destination(p_seller_id uuid, p_channel_id uuid, p_whatsapp text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_seller_id is not null then
      (select s.whatsapp from public.sellers s where s.id = p_seller_id and s.active)
    else coalesce(
      (select p_whatsapp
       from public.whatsapp_channels c
       join public.profiles o on o.id = c.owner_id
       where c.id = p_channel_id and c.active and o.deactivated_at is null),
      (select r.whatsapp
       from public.whatsapp_channels c
       join public.whatsapp_channels r on r.id = c.redirect_channel_id
       join public.profiles o on o.id = r.owner_id
       where c.id = p_channel_id and r.active and o.deactivated_at is null)
    )
  end
$$;


-- -----------------------------------------------------------------------------
-- 4. Funções do módulo (ADMIN e SELLER)
-- -----------------------------------------------------------------------------

drop function public.create_seller_link(uuid, text, text, timestamptz, jsonb);

-- Modelos ativos com o preço padrão atual: ponto de partida de um link novo.
create function public.get_link_show_models()
returns table (id uuid, name text, price numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_create_links() then
    raise exception 'Seu perfil não pode criar links comerciais.' using errcode = '42501';
  end if;
  return query
    select m.id, m.name, m.price
    from public.show_models m
    where m.active
    order by m.position, m.created_at, m.id;
end;
$$;

-- Cria o link e os preços numa transação só (qualquer erro desfaz tudo).
--   p_channel_id: canal ATIVO do próprio usuário (obrigatório).
--   p_validity:   '24h' | '3d' | '7d' | 'custom' (p_expires_at, futuro e até 7 dias).
--   p_items:      [{ "model_id": uuid, "price"?: número }] — um ou mais modelos ativos.
--                 Sem price (ou null) → preço padrão. Diferente do padrão → exige permissão.
-- Autoria, número e identificação do destino vêm do banco, nunca de parâmetro.
create function public.create_commercial_link(
  p_channel_id uuid,
  p_label      text,
  p_validity   text,
  p_expires_at timestamptz,
  p_items      jsonb
)
returns table (
  id         uuid,
  code       text,
  expires_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid        uuid := auth.uid();
  v_customize  boolean;
  v_channel    public.whatsapp_channels;
  v_expires_at timestamptz;
  v_link       public.seller_links;
  v_item       jsonb;
  v_model_id   uuid;
  v_price      numeric;
  v_default    numeric;
  v_ids        uuid[] := '{}';
begin
  if not private.can_create_links() then
    raise exception 'Seu perfil não pode criar links comerciais.' using errcode = '42501';
  end if;
  v_customize := private.can_customize_link_prices();

  if p_validity is null or p_validity not in ('24h', '3d', '7d', 'custom') then
    raise exception 'Validade inválida: use 24h, 3d, 7d ou custom.' using errcode = '22023';
  end if;

  v_expires_at := case p_validity
    when '24h' then now() + interval '24 hours'
    when '3d'  then now() + interval '72 hours'
    when '7d'  then now() + interval '168 hours'
    else p_expires_at
  end;

  if p_validity = 'custom' then
    if v_expires_at is null then
      raise exception 'Informe a data e o horário de expiração do link.' using errcode = '22023';
    end if;
    if v_expires_at <= now() then
      raise exception 'A expiração do link precisa ser uma data e um horário futuros.' using errcode = '22023';
    end if;
    if v_expires_at > now() + interval '168 hours' then
      raise exception 'A validade máxima de um link é de 7 dias.' using errcode = '22023';
    end if;
  end if;

  if p_channel_id is null then
    raise exception 'Escolha o WhatsApp que vai receber os contatos deste link.' using errcode = '22023';
  end if;
  -- Mesmo erro para canal inexistente, de outro usuário ou desativado (não revela qual).
  select * into v_channel
  from public.whatsapp_channels c
  where c.id = p_channel_id and c.owner_id = v_uid and c.active;
  if not found then
    raise exception 'WhatsApp não autorizado para a sua conta. Escolha um dos seus números ativos.'
      using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Escolha ao menos um modelo de show.' using errcode = '22023';
  end if;

  insert into public.seller_links (channel_id, whatsapp, channel_label, label, expires_at, created_by, created_at)
  values (v_channel.id, v_channel.whatsapp, v_channel.label, p_label, v_expires_at, v_uid, now())
  returning * into v_link;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item ->> 'model_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(jsonb_typeof(v_item -> 'price'), 'null') not in ('number', 'null') then
      raise exception 'Valor inválido em um dos modelos de show.' using errcode = '22023';
    end if;
    v_model_id := (v_item ->> 'model_id')::uuid;

    if v_model_id = any (v_ids) then
      raise exception 'Cada modelo de show só pode aparecer uma vez no link.' using errcode = '22023';
    end if;

    select m.price into v_default from public.show_models m where m.id = v_model_id and m.active;
    if not found then
      raise exception 'Os modelos de show mudaram. Recarregue a página e confira os valores.' using errcode = '22023';
    end if;

    v_price := coalesce((v_item ->> 'price')::numeric, v_default);

    -- Mesma regra de show_models.price: maior que zero, até 2 casas (sem arredondar).
    if v_price <= 0 or v_price <> round(v_price, 2) or v_price > 99999999.99 then
      raise exception 'Valor inválido em um dos modelos de show: use reais com até 2 casas decimais, maior que zero.'
        using errcode = '22023';
    end if;
    if v_price <> v_default and not v_customize then
      raise exception 'Seu perfil não pode alterar os valores padrão dos modelos de show.' using errcode = '42501';
    end if;

    v_ids := v_ids || v_model_id;
    insert into public.seller_link_prices (link_id, model_id, price, default_price)
    values (v_link.id, v_model_id, v_price, v_default);
  end loop;

  return query select v_link.id, v_link.code, v_link.expires_at;
end;
$$;

-- Desativa um link antes da expiração. ADMIN: qualquer link; SELLER: só os que criou.
-- Link de outro usuário responde como inexistente.
create or replace function public.deactivate_seller_link(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_link public.seller_links;
begin
  if not private.can_create_links() then
    raise exception 'Seu perfil não pode desativar links comerciais.' using errcode = '42501';
  end if;

  select * into v_link
  from public.seller_links l
  where l.id = p_id and (private.is_admin() or l.created_by = auth.uid())
  for update;
  if not found then
    raise exception 'Link comercial não encontrado.' using errcode = '22023';
  end if;
  if not v_link.active then
    return;
  end if;
  if now() >= v_link.expires_at then
    raise exception 'Este link já expirou e não precisa ser desativado.' using errcode = '22023';
  end if;

  update public.seller_links set active = false, deactivated_by = auth.uid() where id = p_id;
end;
$$;

-- Histórico do módulo: ADMIN vê todos; SELLER só os que criou. Status pelo relógio do banco:
--   'active' | 'expired' | 'revoked' (desativado) | 'inactive' (sem WhatsApp disponível:
--   canal/vendedor desativado sem redirecionamento).
-- destination: o número que recebe os contatos hoje (pode ser o do redirecionamento).
-- SECURITY DEFINER: junta show_models e profiles (que o SELLER não lê), filtrando aqui.
drop function public.get_seller_links();

create function public.get_seller_links()
returns table (
  id              uuid,
  code            text,
  label           text,
  created_by      uuid,
  created_by_name text,
  created_at      timestamptz,
  expires_at      timestamptz,
  deactivated_at  timestamptz,
  status          text,
  seller_id       uuid,
  seller_name     text,
  channel_id      uuid,
  channel_label   text,
  whatsapp        text,
  destination     text,
  prices          jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Atenção: dentro de SECURITY DEFINER, is_trusted_caller() é sempre verdadeiro (current_user
  -- é o dono). A permissão aqui vem só de auth.uid(). O SQL Editor consulta as tabelas direto.
  if not private.can_create_links() then
    raise exception 'Seu perfil não pode consultar links comerciais.' using errcode = '42501';
  end if;

  return query
    select
      l.id, l.code, l.label, l.created_by, author.name, l.created_at, l.expires_at, l.deactivated_at,
      case
        when not l.active then 'revoked'
        when now() >= l.expires_at then 'expired'
        when dest.value is null then 'inactive'
        else 'active'
      end,
      l.seller_id, s.name, l.channel_id, l.channel_label,
      coalesce(l.whatsapp, s.whatsapp),
      dest.value,
      coalesce(
        (select jsonb_agg(
                  jsonb_build_object('model_id', m.id, 'name', m.name, 'price', p.price, 'default_price', p.default_price)
                  order by m.position, m.created_at, m.id)
         from public.seller_link_prices p
         join public.show_models m on m.id = p.model_id
         where p.link_id = l.id),
        '[]'::jsonb
      )
    from public.seller_links l
    left join public.sellers s on s.id = l.seller_id
    left join public.profiles author on author.id = l.created_by
    cross join lateral (select private.link_destination(l.seller_id, l.channel_id, l.whatsapp) as value) dest
    where private.is_admin() or l.created_by = (select auth.uid())
    order by l.created_at desc, l.id;
end;
$$;


-- -----------------------------------------------------------------------------
-- 5. Site público: links novos resolvem pelo canal
-- -----------------------------------------------------------------------------

-- Mesmo formato de retorno. Só o necessário para o site: situação, WhatsApp de destino e
-- expiração (nada de vendedor, canal ou valores).
create or replace function public.get_seller_link(p_code text)
returns table (
  active     boolean,
  whatsapp   text,
  link_kind  text,
  status     text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with req as (select lower(btrim(p_code)) as value),
  resolved as (
    select 'seller'::text as link_kind,
           case when s.active then 'active' else 'inactive' end as status,
           s.whatsapp,
           null::timestamptz as expires_at
    from public.sellers s, req
    where s.code = req.value
    union all
    select 'link'::text,
           case
             when not l.active then 'revoked'
             when now() >= l.expires_at then 'expired'
             when dest.value is null then 'inactive'
             when not exists (select 1 from public.seller_link_prices p where p.link_id = l.id) then 'invalid'
             else 'active'
           end,
           dest.value,
           l.expires_at
    from public.seller_links l
    cross join req
    cross join lateral (select private.link_destination(l.seller_id, l.channel_id, l.whatsapp) as value) dest
    where l.code = req.value
  )
  select r.status = 'active',
         case when r.status = 'active' then r.whatsapp end,
         r.link_kind,
         r.status,
         case when r.status = 'active' then r.expires_at end
  from resolved r
$$;

-- Link temporário válido e com destino disponível → só os modelos e preços gravados nele.
create or replace function public.get_commercial_show_models(p_code text)
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
  with req as (select lower(btrim(p_code)) as value),
  priced as (
    select m.id as model_id, m.price
    from public.show_models m
    where exists (select 1 from public.sellers s, req where s.code = req.value and s.active)
    union all
    select p.model_id, p.price
    from public.seller_links l
    join public.seller_link_prices p on p.link_id = l.id
    cross join req
    where l.code = req.value and l.active and now() < l.expires_at
      and private.link_destination(l.seller_id, l.channel_id, l.whatsapp) is not null
  )
  select m.id, m.name, m.duration, m.description, priced.price
  from priced
  join public.show_models m on m.id = priced.model_id
  where m.active
  order by m.position, m.created_at, m.id
$$;


-- -----------------------------------------------------------------------------
-- 6. Privilégios e RLS
-- -----------------------------------------------------------------------------

alter table public.whatsapp_channels enable row level security;

revoke all on public.whatsapp_channels from anon;
-- Canais não são apagados (desativa-se).
revoke delete, truncate, references, trigger on public.whatsapp_channels from authenticated;

create policy "whatsapp_channels: ADMIN lê todos; usuário lê os próprios"
  on public.whatsapp_channels for select to authenticated
  using ((select private.is_admin()) or (owner_id = (select auth.uid()) and (select private.can_create_links())));

create policy "whatsapp_channels: ADMIN cria"
  on public.whatsapp_channels for insert to authenticated
  with check ((select private.is_admin()));

create policy "whatsapp_channels: ADMIN edita"
  on public.whatsapp_channels for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy "seller_links: ADMIN lê" on public.seller_links;
drop policy "seller_link_prices: ADMIN lê" on public.seller_link_prices;

create policy "seller_links: ADMIN lê todos; usuário lê os que criou"
  on public.seller_links for select to authenticated
  using ((select private.is_admin()) or (created_by = (select auth.uid()) and (select private.can_create_links())));

create policy "seller_link_prices: ADMIN lê todos; usuário lê os dos seus links"
  on public.seller_link_prices for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.can_create_links()) and exists (
      select 1 from public.seller_links l where l.id = link_id and l.created_by = (select auth.uid())
    ))
  );

grant execute on function private.can_create_links(), private.can_customize_link_prices()
  to authenticated, service_role;
revoke execute on function private.can_create_links(), private.can_customize_link_prices() from public, anon;

-- Usadas só por constraints, triggers e funções SECURITY DEFINER.
revoke execute on function
  private.whatsapp_channels_before_write(),
  private.link_destination(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function private.is_channel_owner_profile(uuid) to authenticated, service_role;
revoke execute on function private.is_channel_owner_profile(uuid) from public, anon;
-- A constraint de formato roda com o papel de quem grava.
grant execute on function private.is_valid_whatsapp(text) to authenticated, service_role;
revoke execute on function private.is_valid_whatsapp(text) from public, anon;

revoke execute on function public.get_commercial_link_permissions() from public, anon;
grant execute on function public.get_commercial_link_permissions() to authenticated, service_role;

revoke execute on function public.get_whatsapp_channel_owners() from public, anon;
grant execute on function public.get_whatsapp_channel_owners() to authenticated, service_role;

revoke execute on function public.get_link_show_models() from public, anon;
grant execute on function public.get_link_show_models() to authenticated, service_role;

revoke execute on function public.create_commercial_link(uuid, text, text, timestamptz, jsonb) from public, anon;
grant execute on function public.create_commercial_link(uuid, text, text, timestamptz, jsonb) to authenticated, service_role;

revoke execute on function public.get_seller_links() from public, anon;
grant execute on function public.get_seller_links() to authenticated, service_role;
