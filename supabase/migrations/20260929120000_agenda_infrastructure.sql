-- =============================================================================
-- Agenda — infraestrutura (perfis, shows, financeiro, auditoria, RLS)
--
-- Convenções:
--   * Autenticação é 100% Supabase Auth (auth.users). Nenhuma senha fica em public.*.
--   * Papel do usuário vem de public.profiles, lido por funções SECURITY DEFINER em
--     `private` (schema NÃO exposto pela API) — sem recursão de RLS.
--   * Colunas de auditoria (created_by/updated_by/deleted_by e timestamps) são sempre
--     preenchidas por trigger a partir de auth.uid(); valores enviados pelo cliente
--     são ignorados.
--   * Shows nunca são apagados fisicamente (soft delete via deleted_at/deleted_by).
--   * amount é SEMPRE >= 0 (magnitude). O sinal vem do tipo: EXPENSE subtrai,
--     CACHE e OTHER_REVENUE somam.
--   * Site público lê somente public.get_public_agenda(), que devolve apenas
--     data, horário, local e Instagram. anon não tem acesso a nenhuma tabela.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Schemas e tipos
-- -----------------------------------------------------------------------------

-- Funções auxiliares de segurança ficam fora do schema exposto pela API REST.
create schema if not exists private;

create type public.app_role as enum ('ADMIN', 'EDITOR');

create type public.financial_entry_type as enum ('CACHE', 'OTHER_REVENUE', 'EXPENSE');


-- -----------------------------------------------------------------------------
-- 2. profiles (1:1 com auth.users)
-- -----------------------------------------------------------------------------

create table public.profiles (
  -- CASCADE a partir de auth.users, mas as FKs de auditoria abaixo são RESTRICT:
  -- apagar um usuário que já criou/editou/excluiu algo falha e preserva o histórico.
  -- O fluxo normal de "excluir usuário" é desativar (deactivated_at + ban no Auth).
  id             uuid primary key references auth.users (id) on delete cascade,
  name           text not null,
  role           public.app_role not null default 'EDITOR',
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles (id) on delete restrict,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint profiles_name_not_blank check (char_length(btrim(name)) between 1 and 120),
  constraint profiles_deactivated_by_requires_at check (deactivated_by is null or deactivated_at is not null),
  constraint profiles_timestamps check (updated_at >= created_at)
);

comment on table public.profiles is
  'Dados de aplicação do usuário (nome, papel, status). Credenciais ficam no Supabase Auth.';
comment on column public.profiles.deactivated_at is
  'Preenchido quando um ADMIN "exclui" o usuário. Usuário desativado perde todo acesso via RLS.';


-- -----------------------------------------------------------------------------
-- 3. shows (somente dados públicos + auditoria; nenhum valor financeiro)
-- -----------------------------------------------------------------------------

create table public.shows (
  id              uuid primary key default gen_random_uuid(),
  show_date       date not null,
  show_time       time not null,
  venue_name      text not null,
  venue_instagram text,
  -- Defaults só para os tipos gerados tratarem como opcionais; o trigger sempre
  -- sobrescreve com o usuário da sessão.
  created_by      uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  updated_by      uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  deleted_by      uuid references public.profiles (id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint shows_venue_name_not_blank check (char_length(btrim(venue_name)) between 1 and 160),
  -- Somente o username (sem @, sem URL), no formato aceito pelo Instagram.
  constraint shows_venue_instagram_format check (venue_instagram ~ '^[a-z0-9._]{1,30}$'),
  constraint shows_soft_delete_consistency check ((deleted_at is null) = (deleted_by is null)),
  constraint shows_timestamps check (
    updated_at >= created_at and (deleted_at is null or deleted_at >= created_at)
  )
);

comment on table public.shows is
  'Agenda de shows. Exclusão é lógica (deleted_at). Valores financeiros ficam em show_financial_entries.';
comment on column public.shows.venue_instagram is
  'Username do Instagram da casa, normalizado (minúsculo, sem @ e sem URL).';


-- -----------------------------------------------------------------------------
-- 4. show_financial_entries (dados privados, somente ADMIN)
-- -----------------------------------------------------------------------------

create table public.show_financial_entries (
  id          uuid primary key default gen_random_uuid(),
  show_id     uuid not null references public.shows (id) on delete restrict,
  type        public.financial_entry_type not null,
  description text,
  amount      numeric(12, 2) not null,
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  updated_by  uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint financial_entries_amount_non_negative check (amount >= 0),
  constraint financial_entries_description_not_blank check (
    description is null or char_length(btrim(description)) between 1 and 200
  ),
  constraint financial_entries_timestamps check (updated_at >= created_at)
);

comment on table public.show_financial_entries is
  'Entradas financeiras por show. Acesso exclusivo de ADMIN (RLS).';
comment on column public.show_financial_entries.amount is
  'Magnitude, sempre >= 0. O sinal é dado pelo type: EXPENSE subtrai; CACHE e OTHER_REVENUE somam.';


-- -----------------------------------------------------------------------------
-- 5. Funções
-- -----------------------------------------------------------------------------

-- Papel do usuário autenticado; NULL se não logado, sem perfil ou desativado.
-- SECURITY DEFINER para ler profiles sem passar pelo RLS (evita recursão).
-- Não recebe parâmetros: só responde sobre o próprio auth.uid().
create function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.deactivated_at is null
$$;

create function private.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.current_app_role() is not null
$$;

create function private.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(private.current_app_role() = 'ADMIN', false)
$$;

-- Chamadas que não vêm da API pública (postgres no SQL editor, service_role no
-- servidor) são confiáveis: podem informar colunas de auditoria explicitamente.
create function private.is_trusted_caller()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user not in ('anon', 'authenticated')
$$;

-- Agenda pública: única porta de entrada para visitantes anônimos.
-- Devolve somente colunas públicas de shows ativos; nunca toca em dados financeiros.
create function public.get_public_agenda(p_from date, p_to date)
returns table (
  id              uuid,
  show_date       date,
  show_time       time,
  venue_name      text,
  venue_instagram text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Intervalo de datas inválido.' using errcode = '22023';
  end if;
  if p_to - p_from > 366 then
    raise exception 'Intervalo máximo da agenda pública é de um ano.' using errcode = '22023';
  end if;

  return query
    select s.id, s.show_date, s.show_time, s.venue_name, s.venue_instagram
    from public.shows s
    where s.deleted_at is null
      and s.show_date between p_from and p_to
    order by s.show_date, s.show_time, s.venue_name;
end;
$$;

-- Relatório financeiro agregado por dia/semana (ISO, segunda-feira)/mês/ano.
-- SECURITY INVOKER + checagem explícita: mesmo que o RLS já filtre, um EDITOR
-- recebe erro de permissão em vez de totais zerados.
create function public.get_financial_report(
  p_from     date,
  p_to       date,
  p_group_by text default 'month'
)
returns table (
  period_start        date,
  show_count          bigint,
  entry_count         bigint,
  cache_total         numeric,
  other_revenue_total numeric,
  expense_total       numeric,
  net_total           numeric
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not (private.is_trusted_caller() or private.is_admin()) then
    raise exception 'Somente ADMIN pode acessar relatórios financeiros.' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Intervalo de datas inválido.' using errcode = '22023';
  end if;
  if p_group_by is null or p_group_by not in ('day', 'week', 'month', 'year') then
    raise exception 'Agrupamento inválido: use day, week, month ou year.' using errcode = '22023';
  end if;

  return query
    select
      date_trunc(p_group_by, s.show_date::timestamp)::date                        as period_start,
      count(distinct s.id)                                                        as show_count,
      count(e.id)                                                                 as entry_count,
      coalesce(sum(e.amount) filter (where e.type = 'CACHE'), 0)                  as cache_total,
      coalesce(sum(e.amount) filter (where e.type = 'OTHER_REVENUE'), 0)          as other_revenue_total,
      coalesce(sum(e.amount) filter (where e.type = 'EXPENSE'), 0)                as expense_total,
      coalesce(sum(case when e.type = 'EXPENSE' then -e.amount else e.amount end), 0) as net_total
    from public.shows s
    left join public.show_financial_entries e on e.show_id = s.id
    where s.deleted_at is null
      and s.show_date between p_from and p_to
    group by 1
    order by 1;
end;
$$;


-- -----------------------------------------------------------------------------
-- 6. Triggers (auditoria, normalização e regras de integridade)
-- -----------------------------------------------------------------------------

create function private.profiles_before_write()
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
    if not v_trusted then
      new.deactivated_at := null;
      new.deactivated_by := null;
    end if;
    return new;
  end if;

  -- UPDATE: identidade e criação são imutáveis.
  new.id         := old.id;
  new.created_at := old.created_at;
  new.updated_at := now();

  if not v_trusted then
    if (new.role is distinct from old.role
        or new.deactivated_at is distinct from old.deactivated_at
        or new.deactivated_by is distinct from old.deactivated_by)
       and not private.is_admin() then
      raise exception 'Somente ADMIN pode alterar papel ou status de usuários.' using errcode = '42501';
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
     and (new.role <> 'ADMIN' or new.deactivated_at is not null)
     and not exists (
       select 1 from public.profiles p
       where p.role = 'ADMIN' and p.deactivated_at is null and p.id <> old.id
     ) then
    raise exception 'Não é possível remover o último ADMIN ativo.' using errcode = 'AG003';
  end if;

  return new;
end;
$$;

create function private.shows_before_write()
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

  -- Normalização (a aplicação já normaliza; aqui é a garantia final).
  new.venue_name      := btrim(new.venue_name);
  new.venue_instagram := nullif(lower(ltrim(btrim(new.venue_instagram), '@')), '');

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    if v_trusted then
      new.updated_by := coalesce(new.updated_by, new.created_by);
    else
      new.created_by := v_uid;
      new.updated_by := v_uid;
      new.deleted_at := null;
      new.deleted_by := null;
    end if;
    return new;
  end if;

  -- UPDATE
  if old.deleted_at is not null and new.deleted_at is not null then
    raise exception 'Show excluído não pode ser alterado; restaure-o primeiro.' using errcode = 'AG001';
  end if;

  new.id         := old.id;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := case when v_trusted then coalesce(new.updated_by, old.updated_by) else v_uid end;

  if old.deleted_at is null and new.deleted_at is not null then
    -- Soft delete: horário e autor definidos pelo banco.
    new.deleted_at := now();
    new.deleted_by := case when v_trusted then coalesce(new.deleted_by, new.updated_by) else v_uid end;
  else
    -- Edição comum ou restauração: sem marca de exclusão.
    new.deleted_at := null;
    new.deleted_by := null;
  end if;

  return new;
end;
$$;

create function private.financial_entries_before_write()
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

  new.description := nullif(btrim(new.description), '');

  if tg_op = 'INSERT' then
    if exists (
      select 1 from public.shows s where s.id = new.show_id and s.deleted_at is not null
    ) then
      raise exception 'Não é possível lançar valores em um show excluído.' using errcode = 'AG002';
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

  -- UPDATE: a entrada continua ligada ao mesmo show.
  new.id         := old.id;
  new.show_id    := old.show_id;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := case when v_trusted then coalesce(new.updated_by, old.updated_by) else v_uid end;
  return new;
end;
$$;

create trigger profiles_before_write
  before insert or update on public.profiles
  for each row execute function private.profiles_before_write();

create trigger shows_before_write
  before insert or update on public.shows
  for each row execute function private.shows_before_write();

create trigger financial_entries_before_write
  before insert or update on public.show_financial_entries
  for each row execute function private.financial_entries_before_write();


-- -----------------------------------------------------------------------------
-- 7. Índices
-- -----------------------------------------------------------------------------

-- Agenda pública e listagem do painel: shows ativos por intervalo de datas, já ordenados.
create index shows_active_date_idx
  on public.shows (show_date, show_time)
  where deleted_at is null;

-- "Lixeira" do painel: shows excluídos, mais recentes primeiro.
create index shows_deleted_at_idx
  on public.shows (deleted_at desc)
  where deleted_at is not null;

-- Entradas de um show (FK + join do relatório), em ordem de lançamento.
create index show_financial_entries_show_id_idx
  on public.show_financial_entries (show_id, created_at);


-- -----------------------------------------------------------------------------
-- 8. Privilégios e RLS
-- -----------------------------------------------------------------------------

alter table public.profiles               enable row level security;
alter table public.shows                  enable row level security;
alter table public.show_financial_entries enable row level security;

-- O Supabase concede ALL em public.* para anon/authenticated por padrão; aqui
-- reduzimos ao mínimo. TRUNCATE não passa por RLS, então é sempre revogado.
revoke all on public.profiles, public.shows, public.show_financial_entries from anon;
revoke truncate, references, trigger
  on public.profiles, public.shows, public.show_financial_entries from authenticated;
-- Sem DELETE físico em perfis (desativação) e shows (soft delete).
revoke delete on public.profiles, public.shows from authenticated;

-- Funções auxiliares: só usuários autenticados (necessário para avaliar policies).
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
revoke execute on all functions in schema private from public, anon;
grant execute on function
  private.current_app_role(),
  private.is_staff(),
  private.is_admin(),
  private.is_trusted_caller()
to authenticated, service_role;

revoke execute on function public.get_public_agenda(date, date) from public;
grant execute on function public.get_public_agenda(date, date) to anon, authenticated, service_role;

revoke execute on function public.get_financial_report(date, date, text) from public, anon;
grant execute on function public.get_financial_report(date, date, text) to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 9. Policies
-- -----------------------------------------------------------------------------
-- `(select fn())` faz o Postgres avaliar a função uma vez por consulta (initPlan).

-- profiles
create policy "profiles: staff lê perfis; usuário lê o próprio"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));

create policy "profiles: somente ADMIN cria"
  on public.profiles for insert to authenticated
  with check ((select private.is_admin()));

-- Trigger impede que não-ADMIN altere role/status; aqui só o nome do próprio perfil.
create policy "profiles: ADMIN edita todos; staff edita o próprio"
  on public.profiles for update to authenticated
  using ((select private.is_admin()) or (id = (select auth.uid()) and (select private.is_staff())))
  with check ((select private.is_admin()) or (id = (select auth.uid()) and (select private.is_staff())));

-- shows (ADMIN e EDITOR ativos; inclui excluídos para permitir histórico/lixeira)
create policy "shows: staff lê"
  on public.shows for select to authenticated
  using ((select private.is_staff()));

create policy "shows: staff cria"
  on public.shows for insert to authenticated
  with check ((select private.is_staff()));

create policy "shows: staff edita e exclui logicamente"
  on public.shows for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

-- show_financial_entries (somente ADMIN ativo, em todas as operações)
create policy "financeiro: ADMIN lê"
  on public.show_financial_entries for select to authenticated
  using ((select private.is_admin()));

create policy "financeiro: ADMIN cria"
  on public.show_financial_entries for insert to authenticated
  with check ((select private.is_admin()));

create policy "financeiro: ADMIN edita"
  on public.show_financial_entries for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "financeiro: ADMIN exclui"
  on public.show_financial_entries for delete to authenticated
  using ((select private.is_admin()));
