-- =============================================================================
-- Links comerciais temporários com preços próprios (por vendedor)
--
--   * seller_links       → cada link gerado no painel para um vendedor: código público
--                          aleatório (/r/<code>), identificação opcional, validade
--                          (expires_at, no máximo 7 dias depois de created_at) e status.
--   * seller_link_prices → o preço negociado de cada modelo de show naquele link.
--   * Registro histórico IMUTÁVEL: depois de criado, nada muda além da desativação
--     (ativo → desativado, sem volta). Preço errado = novo link. Nada é apagado (AG007).
--     Mudar show_models.price nunca afeta um link já gerado.
--   * Criação só por create_seller_link() (SECURITY DEFINER, ADMIN): link e todos os
--     preços numa única transação; o banco calcula/valida a validade com now(). Desativação
--     só por deactivate_seller_link(). authenticated só LÊ as tabelas (ADMIN, pelo RLS);
--     anon não tem acesso.
--   * Expirado quando now() >= expires_at (precisão de microssegundos do timestamptz).
--   * Códigos: os temporários têm 16 caracteres (64 bits aleatórios) e são únicos também
--     em relação a sellers.code (trigger serializado por advisory lock nas duas tabelas).
--   * get_seller_link(code) e get_commercial_show_models(code) passam a resolver os dois
--     tipos de código. Link permanente continua com o preço padrão; link temporário usa
--     SOMENTE os preços gravados nele (sem cair no preço padrão).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tabelas
-- -----------------------------------------------------------------------------

create table public.seller_links (
  id             uuid primary key default gen_random_uuid(),
  seller_id      uuid not null references public.sellers (id) on delete restrict,
  -- Código público do link (/r/<code>). Gerado pelo trigger e imutável.
  code           text not null default '',
  -- Identificação opcional para o painel (ex.: "Casamento João"). Não aparece no site.
  label          text,
  expires_at     timestamptz not null,
  active         boolean not null default true,
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles (id) on delete restrict,
  -- Nulo só quando criado pelo SQL Editor.
  created_by     uuid references public.profiles (id) on delete restrict,
  created_at     timestamptz not null default now(),

  constraint seller_links_code_format check (code ~ '^[a-z0-9]{8,32}$'),
  constraint seller_links_code_key unique (code),
  constraint seller_links_label_length check (label is null or char_length(btrim(label)) between 1 and 80),
  -- Horas (e não dias): duração absoluta, sem depender de horário de verão do fuso da sessão.
  constraint seller_links_validity check (
    expires_at > created_at and expires_at <= created_at + interval '168 hours'
  ),
  constraint seller_links_deactivation check (
    (active and deactivated_at is null and deactivated_by is null)
    or (not active and deactivated_at is not null)
  )
);

comment on table public.seller_links is
  'Links comerciais temporários (/r/<code>) com preços próprios por modelo. Imutáveis: só podem ser desativados.';
comment on column public.seller_links.expires_at is
  'Instante de expiração (no máximo 7 dias após created_at). Expirado quando now() >= expires_at.';

-- Histórico do painel: links de um vendedor, mais recentes primeiro.
create index seller_links_seller_idx on public.seller_links (seller_id, created_at desc);

create table public.seller_link_prices (
  link_id  uuid not null references public.seller_links (id) on delete restrict,
  model_id uuid not null references public.show_models (id) on delete restrict,
  -- Em reais, mesma precisão de show_models.price.
  price    numeric(10, 2) not null,

  primary key (link_id, model_id),
  constraint seller_link_prices_price_positive check (price > 0)
);

comment on table public.seller_link_prices is
  'Preço negociado de cada modelo de show num link comercial. Imutável; independente de show_models.price.';


-- -----------------------------------------------------------------------------
-- 2. Códigos únicos nas duas tabelas
-- -----------------------------------------------------------------------------

-- 16 caracteres hexadecimais = 64 bits aleatórios (12 + 4 da parte aleatória de dois
-- UUID v4). O tamanho diferente dos códigos permanentes (12) já evita colisão entre eles.
create function private.new_seller_link_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
           || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
    exit when not exists (select 1 from public.seller_links l where l.code = v_code)
          and not exists (select 1 from public.sellers s where s.code = v_code);
  end loop;
  return v_code;
end;
$$;

-- O gerador dos códigos permanentes também passa a evitar os códigos temporários.
create or replace function private.new_seller_code()
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
    exit when not exists (select 1 from public.sellers s where s.code = v_code)
          and not exists (select 1 from public.seller_links l where l.code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Garantia final (inclusive para códigos informados pelo SQL Editor): um código não pode
-- existir nas duas tabelas. O advisory lock serializa as inserções nas duas tabelas, então
-- a checagem enxerga o que outra transação acabou de gravar. Dentro de cada tabela, quem
-- garante é a constraint unique. SECURITY DEFINER: a checagem não pode depender do RLS.
create function private.link_code_is_free()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('public.link_codes'));
  if (tg_table_name = 'sellers' and exists (select 1 from public.seller_links l where l.code = new.code))
     or (tg_table_name = 'seller_links' and exists (select 1 from public.sellers s where s.code = new.code)) then
    raise exception 'Código de link já está em uso.' using errcode = '23505';
  end if;
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. Triggers (auditoria, código e imutabilidade)
-- -----------------------------------------------------------------------------

create function private.seller_links_before_write()
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
    -- O código sempre vem do banco (o SQL Editor pode informar um, para migrações).
    if not v_trusted or coalesce(new.code, '') = '' then
      new.code := private.new_seller_link_code();
    end if;
    if not v_trusted then
      new.created_at := now();
      new.created_by := v_uid;
    end if;
    -- Todo link nasce ativo.
    new.active         := true;
    new.deactivated_at := null;
    new.deactivated_by := null;
    return new;
  end if;

  -- UPDATE: só a desativação (ativo → desativado). Preços, validade e código são histórico.
  if new.id is distinct from old.id
     or new.seller_id is distinct from old.seller_id
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

create function private.seller_link_prices_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Os valores de um link comercial não podem ser alterados. Crie um novo link.'
    using errcode = 'AG007';
end;
$$;

create trigger seller_links_before_write
  before insert or update or delete on public.seller_links
  for each row execute function private.seller_links_before_write();

-- Nomes em ordem alfabética: roda depois do trigger que gera o código.
create trigger seller_links_code_unique
  before insert on public.seller_links
  for each row execute function private.link_code_is_free();

create trigger sellers_code_unique
  before insert on public.sellers
  for each row execute function private.link_code_is_free();

create trigger seller_link_prices_immutable
  before update or delete on public.seller_link_prices
  for each row execute function private.seller_link_prices_immutable();


-- -----------------------------------------------------------------------------
-- 4. Funções do painel (ADMIN)
-- -----------------------------------------------------------------------------

-- Cria o link e todos os preços numa transação só (qualquer erro desfaz tudo).
--   p_validity: '24h' | '3d' | '7d' (o banco calcula a partir de now()) ou 'custom'
--               (p_expires_at, que precisa ser depois de now() e até now() + 7 dias).
--   p_prices:   [{ "model_id": uuid, "price": número }], exatamente um por modelo ATIVO.
-- SECURITY DEFINER porque authenticated não tem INSERT nas tabelas (o link só nasce por
-- aqui, validado). A permissão é checada explicitamente (ADMIN ativo) e a autoria vem de
-- auth.uid(), nunca de parâmetro.
create function public.create_seller_link(
  p_seller_id  uuid,
  p_label      text,
  p_validity   text,
  p_expires_at timestamptz,
  p_prices     jsonb
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
  v_expires_at timestamptz;
  v_link       public.seller_links;
  v_item       jsonb;
  v_model_id   uuid;
  v_price      numeric;
  v_ids        uuid[] := '{}';
begin
  if not private.is_admin() then
    raise exception 'Somente ADMIN pode criar links comerciais.' using errcode = '42501';
  end if;

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

  if not exists (select 1 from public.sellers s where s.id = p_seller_id and s.active) then
    raise exception 'Vendedor não encontrado ou desativado.' using errcode = '22023';
  end if;

  if p_prices is null or jsonb_typeof(p_prices) <> 'array' or jsonb_array_length(p_prices) = 0 then
    raise exception 'Informe o valor de cada modelo de show.' using errcode = '22023';
  end if;

  insert into public.seller_links (seller_id, label, expires_at, created_by, created_at)
  values (p_seller_id, p_label, v_expires_at, auth.uid(), now())
  returning * into v_link;

  for v_item in select value from jsonb_array_elements(p_prices) loop
    if jsonb_typeof(v_item) <> 'object'
       or jsonb_typeof(v_item -> 'price') is distinct from 'number'
       or coalesce(v_item ->> 'model_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Valor inválido em um dos modelos de show.' using errcode = '22023';
    end if;
    v_model_id := (v_item ->> 'model_id')::uuid;
    v_price    := (v_item ->> 'price')::numeric;

    -- Mesma regra de show_models.price: maior que zero, até 2 casas (sem arredondar).
    if v_price <= 0 or v_price <> round(v_price, 2) or v_price > 99999999.99 then
      raise exception 'Valor inválido em um dos modelos de show: use reais com até 2 casas decimais, maior que zero.'
        using errcode = '22023';
    end if;
    if v_model_id = any (v_ids) then
      raise exception 'Cada modelo de show só pode ter um valor no link.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.show_models m where m.id = v_model_id and m.active) then
      raise exception 'Os modelos de show mudaram. Recarregue a página e confira os valores.' using errcode = '22023';
    end if;

    v_ids := v_ids || v_model_id;
    insert into public.seller_link_prices (link_id, model_id, price) values (v_link.id, v_model_id, v_price);
  end loop;

  -- Todo modelo ativo precisa de preço: o link nunca cai no preço padrão.
  if exists (select 1 from public.show_models m where m.active and not (m.id = any (v_ids))) then
    raise exception 'Os modelos de show mudaram. Recarregue a página e confira os valores.' using errcode = '22023';
  end if;

  return query select v_link.id, v_link.code, v_link.expires_at;
end;
$$;

-- Desativa (revoga) um link antes da expiração. Idempotente; não apaga nem altera preços.
create function public.deactivate_seller_link(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_link public.seller_links;
begin
  if not private.is_admin() then
    raise exception 'Somente ADMIN pode desativar links comerciais.' using errcode = '42501';
  end if;

  select * into v_link from public.seller_links l where l.id = p_id for update;
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

-- Histórico do painel: todos os links, com status calculado pelo relógio do banco e os
-- preços gravados (na ordem de exibição dos modelos). SECURITY INVOKER: o RLS vale; a
-- checagem explícita dá erro de permissão em vez de lista vazia.
--   status: 'active' | 'expired' (prazo encerrado) | 'revoked' (desativado antes de expirar)
create function public.get_seller_links()
returns table (
  id             uuid,
  seller_id      uuid,
  code           text,
  label          text,
  created_by     uuid,
  created_at     timestamptz,
  expires_at     timestamptz,
  deactivated_at timestamptz,
  status         text,
  prices         jsonb
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not (private.is_trusted_caller() or private.is_admin()) then
    raise exception 'Somente ADMIN pode consultar links comerciais.' using errcode = '42501';
  end if;

  return query
    select
      l.id, l.seller_id, l.code, l.label, l.created_by, l.created_at, l.expires_at, l.deactivated_at,
      case
        when not l.active then 'revoked'
        when now() >= l.expires_at then 'expired'
        else 'active'
      end,
      coalesce(
        (select jsonb_agg(
                  jsonb_build_object('model_id', m.id, 'name', m.name, 'price', p.price)
                  order by m.position, m.created_at, m.id)
         from public.seller_link_prices p
         join public.show_models m on m.id = p.model_id
         where p.link_id = l.id),
        '[]'::jsonb
      )
    from public.seller_links l
    order by l.created_at desc, l.id;
end;
$$;


-- -----------------------------------------------------------------------------
-- 5. Site público: os dois tipos de código
-- -----------------------------------------------------------------------------

-- O tipo de retorno muda (novas colunas): precisa recriar. active e whatsapp continuam
-- as duas primeiras colunas, com o mesmo significado (compatível com o código anterior).
--   link_kind: 'seller' (permanente, sellers.code) | 'link' (temporário, seller_links.code)
--   status:    'active' | 'inactive' (vendedor desativado) | 'expired' | 'revoked'
--              (link desativado) | 'invalid' (link sem preços: dado inconsistente)
--   whatsapp e expires_at só quando status = 'active'.
-- Código inexistente → nenhuma linha.
drop function public.get_seller_link(text);

create function public.get_seller_link(p_code text)
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
             when not s.active then 'inactive'
             when not exists (select 1 from public.seller_link_prices p where p.link_id = l.id) then 'invalid'
             else 'active'
           end,
           s.whatsapp,
           l.expires_at
    from public.seller_links l
    join public.sellers s on s.id = l.seller_id
    cross join req
    where l.code = req.value
  )
  select r.status = 'active',
         case when r.status = 'active' then r.whatsapp end,
         r.link_kind,
         r.status,
         case when r.status = 'active' then r.expires_at end
  from resolved r
$$;

-- Versão comercial: mesmos modelos ativos e ordem da versão pública, com o preço.
--   * código permanente de vendedor ativo → preço padrão (show_models.price);
--   * código temporário ativo, dentro da validade e de vendedor ativo → SÓ os modelos e
--     preços gravados no link (modelo criado depois não entra; desativado sai).
-- Qualquer outro caso → nada.
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
    join public.sellers s on s.id = l.seller_id
    join public.seller_link_prices p on p.link_id = l.id
    cross join req
    where l.code = req.value and l.active and s.active and now() < l.expires_at
  )
  select m.id, m.name, m.duration, m.description, priced.price
  from priced
  join public.show_models m on m.id = priced.model_id
  where m.active
  order by m.position, m.created_at, m.id
$$;

comment on function public.get_commercial_show_models(text) is
  'Modelos ativos com preço: padrão para o código de um vendedor ativo; os gravados no link para um link temporário válido.';


-- -----------------------------------------------------------------------------
-- 6. Privilégios e RLS
-- -----------------------------------------------------------------------------

alter table public.seller_links       enable row level security;
alter table public.seller_link_prices enable row level security;

revoke all on public.seller_links, public.seller_link_prices from anon;
-- Escrita só pelas funções acima (histórico imutável): authenticated apenas lê (RLS: ADMIN).
revoke insert, update, delete, truncate, references, trigger
  on public.seller_links, public.seller_link_prices from authenticated;

create policy "seller_links: ADMIN lê"
  on public.seller_links for select to authenticated
  using ((select private.is_admin()));

create policy "seller_link_prices: ADMIN lê"
  on public.seller_link_prices for select to authenticated
  using ((select private.is_admin()));

revoke execute on function public.get_seller_link(text) from public;
grant execute on function public.get_seller_link(text) to anon, authenticated, service_role;

revoke execute on function public.create_seller_link(uuid, text, text, timestamptz, jsonb) from public, anon;
grant execute on function public.create_seller_link(uuid, text, text, timestamptz, jsonb) to authenticated, service_role;

revoke execute on function public.deactivate_seller_link(uuid) from public, anon;
grant execute on function public.deactivate_seller_link(uuid) to authenticated, service_role;

revoke execute on function public.get_seller_links() from public, anon;
grant execute on function public.get_seller_links() to authenticated, service_role;

-- Chamadas só por triggers e pelas funções acima (que rodam como o dono).
revoke execute on function
  private.new_seller_link_code(),
  private.link_code_is_free(),
  private.seller_links_before_write(),
  private.seller_link_prices_immutable()
from public, anon;
