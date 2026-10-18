-- =============================================================================
-- Valor particular e valor corporativo por modelo de show
--
--   * show_models.price passa a ser o valor PARTICULAR (eventos particulares) e ganha
--     corporate_price (eventos corporativos). Os dois são editados de forma independente
--     no painel. Os modelos existentes recebem corporate_price = price + 500.
--   * Na criação do link, cada item pode trazer "tier": 'private' (padrão) ou 'corporate'.
--     O tipo só escolhe o valor de partida: sem price → valor do tipo; price diferente do
--     valor do tipo → exige permissão de personalizar, como antes.
--   * Inserção direta sem corporate_price (SQL Editor): o banco usa price + 500.
--   * O link continua gravando o valor ofertado (price) e o padrão da época (default_price,
--     agora o do tipo escolhido). O tipo não fica gravado: serve só para agilizar a criação.
--     O site sempre usa o valor gravado no link até ele expirar ou ser desativado.
--
--   Pré-requisito: todas as migrations anteriores, até 20261018120300_remove_legacy_sellers.
-- =============================================================================

-- Falha cedo, com uma mensagem clara, se o banco não tem as migrations anteriores.
do $$
begin
  if to_regclass('public.show_models') is null
     or to_regclass('public.seller_link_prices') is null
     or to_regprocedure('public.get_link_show_models()') is null
     or to_regprocedure('public.create_commercial_link(uuid, text, text, timestamptz, jsonb)') is null then
    raise exception 'Este banco não tem as migrations anteriores (show_models e links comerciais).'
      using hint = 'Confira se o SQL Editor está no projeto certo e aplique, em ordem, as migrations de supabase/migrations até 20261018120300_remove_legacy_sellers.sql.';
  end if;
end;
$$;

alter table public.show_models add column corporate_price numeric(10, 2);

update public.show_models set corporate_price = price + 500;

alter table public.show_models
  alter column corporate_price set not null,
  add constraint show_models_corporate_price_positive check (corporate_price > 0);

-- Inserção sem valor corporativo (ex.: SQL Editor): particular + 500. O painel sempre envia.
create function private.show_models_default_corporate_price()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.corporate_price := coalesce(new.corporate_price, new.price + 500);
  return new;
end;
$$;

revoke execute on function private.show_models_default_corporate_price() from public, anon;

create trigger show_models_default_corporate_price
  before insert on public.show_models
  for each row execute function private.show_models_default_corporate_price();

comment on column public.show_models.price is
  'Valor particular em reais: padrão dos links comerciais de eventos particulares.';
comment on column public.show_models.corporate_price is
  'Valor corporativo em reais: padrão dos links comerciais de eventos corporativos.';

-- O tipo de retorno muda: precisa recriar.
drop function public.get_link_show_models();

create function public.get_link_show_models()
returns table (id uuid, name text, price numeric, corporate_price numeric)
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
    select m.id, m.name, m.price, m.corporate_price
    from public.show_models m
    where m.active
    order by m.position, m.created_at, m.id;
end;
$$;

revoke execute on function public.get_link_show_models() from public, anon;
grant execute on function public.get_link_show_models() to authenticated, service_role;

-- Igual à versão da 20261018120100, com o tipo de evento por item:
--   p_items: [{ "model_id": uuid, "tier"?: 'private' | 'corporate', "price"?: número }]
--            tier ausente/null → 'private'. Sem price → valor padrão do tipo.
--            Price diferente do padrão do tipo → exige permissão.
-- "create or replace" mantém a assinatura e os privilégios.
create or replace function public.create_commercial_link(
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
  v_tier       text;
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
       or coalesce(jsonb_typeof(v_item -> 'price'), 'null') not in ('number', 'null')
       or coalesce(v_item ->> 'tier', 'private') not in ('private', 'corporate') then
      raise exception 'Valor inválido em um dos modelos de show.' using errcode = '22023';
    end if;
    v_model_id := (v_item ->> 'model_id')::uuid;
    v_tier := coalesce(v_item ->> 'tier', 'private');

    if v_model_id = any (v_ids) then
      raise exception 'Cada modelo de show só pode aparecer uma vez no link.' using errcode = '22023';
    end if;

    select case when v_tier = 'corporate' then m.corporate_price else m.price end into v_default
    from public.show_models m where m.id = v_model_id and m.active;
    if not found then
      raise exception 'Os modelos de show mudaram. Recarregue a página e confira os valores.' using errcode = '22023';
    end if;

    v_price := coalesce((v_item ->> 'price')::numeric, v_default);

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
