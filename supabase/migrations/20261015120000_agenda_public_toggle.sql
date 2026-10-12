-- =============================================================================
-- Agenda no site público: habilitar/desabilitar pelo painel
--
--   * agenda_settings: linha única (id = true) com public_enabled. Começa DESABILITADA:
--     o site continua igual até o painel ligar a agenda.
--   * Habilitada, a Home mostra a seção AGENDA (próximos shows, via get_public_agenda)
--     e o link AGENDA na topbar/menu lateral.
--   * Site público lê somente public.get_public_agenda_settings(). anon não acessa a tabela.
--   * ADMIN e EDITOR ativos podem ligar e desligar, como nas demais telas do painel.
-- =============================================================================

create table public.agenda_settings (
  id             boolean primary key default true,
  public_enabled boolean not null default false,
  updated_by     uuid references public.profiles (id) on delete restrict,
  updated_at     timestamptz not null default now(),

  constraint agenda_settings_singleton check (id)
);

comment on table public.agenda_settings is
  'Configuração da agenda no site. public_enabled = true mostra a seção AGENDA e o link na navegação.';

insert into public.agenda_settings (id) values (true) on conflict (id) do nothing;

create function private.agenda_settings_before_update()
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
  new.id         := old.id;
  new.updated_at := now();
  new.updated_by := case when v_trusted then coalesce(new.updated_by, old.updated_by) else v_uid end;
  return new;
end;
$$;

create trigger agenda_settings_before_update
  before update on public.agenda_settings
  for each row execute function private.agenda_settings_before_update();

-- Site público: só o interruptor.
create function public.get_public_agenda_settings()
returns table (
  public_enabled boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.public_enabled
  from public.agenda_settings s
  where s.id
$$;

alter table public.agenda_settings enable row level security;

revoke all on public.agenda_settings from anon;
-- Linha única criada aqui: o painel só lê e altera.
revoke insert, delete, truncate, references, trigger on public.agenda_settings from authenticated;

revoke execute on function public.get_public_agenda_settings() from public;
grant execute on function public.get_public_agenda_settings() to anon, authenticated, service_role;

revoke execute on function private.agenda_settings_before_update() from public, anon;

create policy "agenda_settings: staff lê"
  on public.agenda_settings for select to authenticated
  using ((select private.is_staff()));

create policy "agenda_settings: staff edita"
  on public.agenda_settings for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));
