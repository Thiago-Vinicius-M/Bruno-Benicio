-- =============================================================================
-- Remoção dos vendedores antigos (contatos sem conta) e dos links permanentes
--
--   * Apaga, de forma IRREVERSÍVEL: a tabela public.sellers (links permanentes /r/<código>
--     com preço padrão) e os links temporários antigos criados para esses vendedores
--     (seller_links.seller_id), com os preços deles.
--   * Links comerciais passam a existir só por canal de WhatsApp de um usuário
--     (channel_id, whatsapp e channel_label obrigatórios).
--   * Funções simplificadas: get_seller_link, get_commercial_show_models,
--     get_seller_links, link_destination, new_seller_link_code e o trigger de imutabilidade
--     deixam de olhar para sellers. get_seller_link mantém o mesmo formato de retorno
--     (link_kind passa a ser sempre 'link'), para não quebrar o código já publicado.
--   * Saem: private.new_seller_code, private.sellers_before_write e private.link_code_is_free
--     (a unicidade do código agora é só a constraint seller_links_code_key).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Dados dos vendedores antigos
-- -----------------------------------------------------------------------------

-- A imutabilidade (AG007) é desligada só aqui, dentro desta migration.
alter table public.seller_link_prices disable trigger seller_link_prices_immutable;
alter table public.seller_links disable trigger seller_links_before_write;

delete from public.seller_link_prices p
using public.seller_links l
where p.link_id = l.id and l.seller_id is not null;

delete from public.seller_links where seller_id is not null;

alter table public.seller_links enable trigger seller_links_before_write;
alter table public.seller_link_prices enable trigger seller_link_prices_immutable;


-- -----------------------------------------------------------------------------
-- 2. Estrutura
-- -----------------------------------------------------------------------------

drop trigger seller_links_code_unique on public.seller_links;

alter table public.seller_links
  drop constraint seller_links_destination,
  drop column seller_id,
  alter column channel_id set not null,
  alter column whatsapp set not null,
  alter column channel_label set not null,
  add constraint seller_links_whatsapp_format check (private.is_valid_whatsapp(whatsapp));

comment on column public.seller_links.whatsapp is
  'Número do canal usado na criação. Imutável: o destino da proposta não muda com o cadastro.';

drop table public.sellers;

drop function private.link_code_is_free();
drop function private.sellers_before_write();
drop function private.new_seller_code();


-- -----------------------------------------------------------------------------
-- 3. Funções
-- -----------------------------------------------------------------------------

create or replace function private.new_seller_link_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789abcdefghijkmnpqrstuvwxyz';
  v_bytes bytea;
  v_code  text;
  v_index integer;
begin
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    foreach v_index in array array[0, 1, 2, 3, 4, 5, 7, 9] loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_index) & 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.seller_links l where l.code = v_code);
  end loop;
  return v_code;
end;
$$;

comment on function private.new_seller_link_code() is
  'Código público de link comercial: 8 caracteres aleatórios (alfabeto sem 0/o/1/l), único em seller_links.';

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

-- Para onde vão os contatos hoje: o número gravado, se o canal e o dono estão ativos; senão
-- o canal de redirecionamento definido pelo ADMIN, se ele e o dono estão ativos; senão null.
drop function private.link_destination(uuid, uuid, text);

create function private.link_destination(p_channel_id uuid, p_whatsapp text)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
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
$$;

revoke execute on function private.link_destination(uuid, text) from public, anon, authenticated;

-- Mesmo formato de retorno de antes (compatível com o código publicado).
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
  with resolved as (
    select case
             when not l.active then 'revoked'
             when now() >= l.expires_at then 'expired'
             when dest.value is null then 'inactive'
             when not exists (select 1 from public.seller_link_prices p where p.link_id = l.id) then 'invalid'
             else 'active'
           end as status,
           dest.value as whatsapp,
           l.expires_at
    from public.seller_links l
    cross join lateral (select private.link_destination(l.channel_id, l.whatsapp) as value) dest
    where l.code = lower(btrim(p_code))
  )
  select r.status = 'active',
         case when r.status = 'active' then r.whatsapp end,
         'link'::text,
         r.status,
         case when r.status = 'active' then r.expires_at end
  from resolved r
$$;

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
  select m.id, m.name, m.duration, m.description, p.price
  from public.seller_links l
  join public.seller_link_prices p on p.link_id = l.id
  join public.show_models m on m.id = p.model_id
  where l.code = lower(btrim(p_code))
    and l.active
    and now() < l.expires_at
    and m.active
    and private.link_destination(l.channel_id, l.whatsapp) is not null
  order by m.position, m.created_at, m.id
$$;

comment on function public.get_commercial_show_models(text) is
  'Modelos e preços gravados num link comercial válido (ativo, no prazo e com WhatsApp disponível).';

-- O retorno muda (sem seller_id/seller_name): precisa recriar.
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
  -- Dentro de SECURITY DEFINER, is_trusted_caller() é sempre verdadeiro: a permissão vem só
  -- de auth.uid(). O SQL Editor consulta as tabelas direto.
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
      l.channel_id, l.channel_label, l.whatsapp, dest.value,
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
    left join public.profiles author on author.id = l.created_by
    cross join lateral (select private.link_destination(l.channel_id, l.whatsapp) as value) dest
    where private.is_admin() or l.created_by = (select auth.uid())
    order by l.created_at desc, l.id;
end;
$$;

revoke execute on function public.get_seller_links() from public, anon;
grant execute on function public.get_seller_links() to authenticated, service_role;
