-- =============================================================================
-- WhatsApp: cada ADMIN vê e administra só os números que ele cadastrou
--
--   * Leitura (RLS): o dono continua lendo os próprios canais (é com eles que gera links);
--     o ADMIN lê também os canais que ELE cadastrou (created_by), não mais os de todos.
--   * Alteração (RLS): só o ADMIN que cadastrou o canal (desativar, reativar, redirecionar,
--     identificação e principal). Canais sem created_by (inseridos pelo SQL Editor) só
--     mudam pelo SQL Editor.
--   * Redirecionamento: só para um canal ativo que o ADMIN enxerga (o trigger consulta com
--     o RLS de quem altera).
--   * "Um principal por usuário": tirar o principal anterior do mesmo dono passa a ser
--     feito por uma função SECURITY DEFINER, porque o canal anterior pode ter sido
--     cadastrado por outro ADMIN (invisível pelo RLS) e o índice único barraria a troca.
--   * Links e site público não mudam: link_destination, get_seller_link e get_seller_links
--     são SECURITY DEFINER e continuam enxergando todos os canais.
--
--   Pré-requisito: 20261018120100_commercial_links_module (whatsapp_channels).
-- =============================================================================

do $$
begin
  if to_regclass('public.whatsapp_channels') is null then
    raise exception 'Este banco não tem a tabela whatsapp_channels (migration 20261018120100).'
      using hint = 'Confira se o SQL Editor está no projeto certo e aplique, em ordem, as migrations anteriores.';
  end if;
end;
$$;

drop policy "whatsapp_channels: ADMIN lê todos; usuário lê os próprios" on public.whatsapp_channels;
drop policy "whatsapp_channels: ADMIN edita" on public.whatsapp_channels;

create policy "whatsapp_channels: dono lê os próprios; ADMIN lê os que cadastrou"
  on public.whatsapp_channels for select to authenticated
  using (
    (owner_id = (select auth.uid()) and (select private.can_create_links()))
    or ((select private.is_admin()) and created_by = (select auth.uid()))
  );

create policy "whatsapp_channels: ADMIN edita os que cadastrou"
  on public.whatsapp_channels for update to authenticated
  using ((select private.is_admin()) and created_by = (select auth.uid()))
  with check ((select private.is_admin()) and created_by = (select auth.uid()));

-- Tira o principal dos outros canais do mesmo dono, inclusive os cadastrados por outro
-- ADMIN. Chamada pelo trigger, que roda como o usuário logado (por isso o EXECUTE para
-- authenticated); o schema private não é exposto pela API, e a função ainda confere o
-- papel: só ADMIN ou o SQL Editor (sem auth.uid()).
create function private.clear_other_primary_channels(p_owner_id uuid, p_keep_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not private.is_admin() then
    raise exception 'Somente ADMIN pode administrar os canais de WhatsApp.' using errcode = '42501';
  end if;
  update public.whatsapp_channels c
  set is_primary = false
  where c.owner_id = p_owner_id and c.is_primary and c.id <> p_keep_id;
end;
$$;

revoke execute on function private.clear_other_primary_channels(uuid, uuid) from public, anon;
grant execute on function private.clear_other_primary_channels(uuid, uuid) to authenticated, service_role;

-- Igual à versão da 20261018120100; só a troca de principal passou para a função acima.
create or replace function private.whatsapp_channels_before_write()
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
    perform private.clear_other_primary_channels(new.owner_id, new.id);
  end if;

  return new;
end;
$$;
