-- =============================================================================
-- Usuários do painel: gestão exclusiva de ADMIN
--
--   * profiles: ADMIN lê e edita todos; os demais leem só o próprio perfil (necessário
--     para a autenticação) e não editam nada. Antes, qualquer staff lia todos e podia
--     editar o próprio nome.
--   * Autoria de exibição (nomes em "criado/excluído por") passa a vir de
--     public.get_team_names(), que devolve somente id e nome.
--   * Auditoria de administração: created_by (quem convidou) e updated_by (última
--     alteração), preenchidos pelo trigger a partir da sessão.
--   * Um ADMIN não remove o próprio acesso (AG004), e a checagem do último ADMIN ativo
--     (AG003) é serializada para duas remoções simultâneas não zerarem os ADMINs.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Auditoria
-- -----------------------------------------------------------------------------

alter table public.profiles
  add column created_by uuid references public.profiles (id) on delete restrict,
  add column updated_by uuid references public.profiles (id) on delete restrict;

comment on column public.profiles.created_by is 'ADMIN que convidou o usuário (NULL no bootstrap pelo SQL Editor).';
comment on column public.profiles.updated_by is 'Quem fez a última alteração no perfil (nome, papel ou status).';


-- -----------------------------------------------------------------------------
-- 2. Trigger de profiles
-- -----------------------------------------------------------------------------

create or replace function private.profiles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid     uuid    := auth.uid();
  v_trusted boolean := private.is_trusted_caller();
begin
  new.name := btrim(new.name);

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    if v_trusted then
      new.updated_by := coalesce(new.updated_by, new.created_by);
    else
      new.created_by     := v_uid;
      new.updated_by     := v_uid;
      new.deactivated_at := null;
      new.deactivated_by := null;
    end if;
    return new;
  end if;

  -- UPDATE: identidade, criação e autoria da criação são imutáveis.
  new.id         := old.id;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := case when v_trusted then coalesce(new.updated_by, old.updated_by) else v_uid end;

  if not v_trusted then
    if (new.role is distinct from old.role
        or new.deactivated_at is distinct from old.deactivated_at
        or new.deactivated_by is distinct from old.deactivated_by)
       and not private.is_admin() then
      raise exception 'Somente ADMIN pode alterar papel ou status de usuários.' using errcode = '42501';
    end if;

    -- Evita lockout acidental: o próprio ADMIN não se rebaixa nem se desativa.
    if old.id = v_uid and old.role = 'ADMIN'
       and (new.role <> 'ADMIN' or (old.deactivated_at is null and new.deactivated_at is not null)) then
      raise exception 'Você não pode remover o próprio acesso administrativo.' using errcode = 'AG004';
    end if;

    if old.deactivated_at is null and new.deactivated_at is not null then
      new.deactivated_at := now();
      new.deactivated_by := v_uid;
    elsif new.deactivated_at is null then
      new.deactivated_by := null;
    else
      new.deactivated_at := old.deactivated_at;
      new.deactivated_by := old.deactivated_by;
    end if;
  end if;

  -- Nunca deixar o sistema sem um ADMIN ativo.
  if old.role = 'ADMIN' and old.deactivated_at is null
     and (new.role <> 'ADMIN' or new.deactivated_at is not null) then
    -- Serializa remoções de ADMIN: a segunda espera a primeira terminar e, como cada
    -- consulta do plpgsql tira um snapshot novo, enxerga o resultado dela.
    perform pg_advisory_xact_lock(hashtext('public.profiles:last_admin_guard'));
    if not exists (
      select 1 from public.profiles p
      where p.role = 'ADMIN' and p.deactivated_at is null and p.id <> old.id
    ) then
      raise exception 'Não é possível remover o último administrador ativo.' using errcode = 'AG003';
    end if;
  end if;

  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. Nomes da equipe para exibição de autoria
-- -----------------------------------------------------------------------------

-- Somente id e nome (sem papel, status ou auditoria), e só para staff ativo.
create function public.get_team_names()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name
  from public.profiles p
  where (select private.is_staff())
  order by p.name
$$;

revoke execute on function public.get_team_names() from public, anon;
grant execute on function public.get_team_names() to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 4. Policies de profiles
-- -----------------------------------------------------------------------------

drop policy "profiles: staff lê perfis; usuário lê o próprio" on public.profiles;
drop policy "profiles: ADMIN edita todos; staff edita o próprio" on public.profiles;

-- O próprio perfil continua legível (inclusive desativado) para a aplicação saber
-- o estado da conta; a lista completa é só para ADMIN ativo.
create policy "profiles: ADMIN lê todos; usuário lê o próprio"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy "profiles: somente ADMIN edita"
  on public.profiles for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
