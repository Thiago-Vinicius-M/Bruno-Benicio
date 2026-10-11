-- =============================================================================
-- Preços só na versão comercial + classificação editorial e limites dos vídeos
--
--   Modelos de show
--   * get_public_show_models() deixa de devolver o preço: o site público (sem link de
--     vendedor) recebe só nome, duração e descrição.
--   * get_commercial_show_models(code) devolve os modelos ativos COM preço, mas só para
--     o código de um vendedor ativo. Código inválido ou de vendedor inativo → nada.
--
--   Vídeos
--   * placement (classificação editorial, independente da orientação):
--       main      → vídeo principal da Home (no máximo um; pode ser vertical ou horizontal)
--       secondary → entra na Home, depois do principal, até o limite do dispositivo
--       gallery   → só na galeria do "Ver mais"
--   * active = false tira o vídeo do site (Home e "Ver mais") sem apagá-lo.
--   * Os vídeos que estavam na Home (featured) viram secundários e os demais, "Ver mais".
--     Nenhum vira principal automaticamente: a Home continua igual até o painel escolher.
--   * set_main_video(id) troca o principal numa operação só: o anterior vira o primeiro
--     secundário (continua na Home). Um índice único garante um só principal mesmo com
--     atualizações simultâneas.
--   * A regra "pelo menos um destaque" (AG005) deixa de existir: sem principal nem
--     secundários, a seção continua funcionando com o que houver.
--   * video_settings: limites de vídeos na Home para desktop e celular (1 a 12). O valor
--     inicial (3 e 3) é o comportamento anterior: 3 destaques nos dois formatos.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Modelos de show: preço fora da leitura pública
-- -----------------------------------------------------------------------------

-- O tipo de retorno muda (sem price): precisa recriar.
drop function public.get_public_show_models();

create function public.get_public_show_models()
returns table (
  id          uuid,
  name        text,
  duration    text,
  description text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.name, m.duration, m.description
  from public.show_models m
  where m.active
  order by m.position, m.created_at, m.id
$$;

-- Versão comercial: mesmos modelos e ordem, com o preço, só para o link de um vendedor
-- ativo. O código é a credencial (aleatório, imutável, independente de nome e telefone).
create function public.get_commercial_show_models(p_code text)
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
    and exists (
      select 1 from public.sellers s
      where s.code = lower(btrim(p_code)) and s.active
    )
  order by m.position, m.created_at, m.id
$$;

revoke execute on function public.get_public_show_models() from public;
grant execute on function public.get_public_show_models() to anon, authenticated, service_role;

revoke execute on function public.get_commercial_show_models(text) from public;
grant execute on function public.get_commercial_show_models(text) to anon, authenticated, service_role;

comment on function public.get_commercial_show_models(text) is
  'Modelos ativos com preço, somente para o código de um vendedor ativo (link /r/<code>).';


-- -----------------------------------------------------------------------------
-- 2. Vídeos: classificação editorial e ativação
-- -----------------------------------------------------------------------------

create type public.video_placement as enum ('main', 'secondary', 'gallery');

-- A regra do destaque obrigatório sai antes de mexer nos dados.
drop trigger videos_require_featured on public.videos;
drop function private.videos_require_featured();

alter table public.videos
  add column placement public.video_placement,
  add column active    boolean not null default true;

-- Home → secundário; "Ver mais" → galeria. A ordem (position) é preservada.
update public.videos
set placement = case when featured then 'secondary'::public.video_placement else 'gallery'::public.video_placement end;

alter table public.videos
  alter column placement set not null,
  alter column placement set default 'secondary';

-- get_public_videos e o trigger leem featured: saem/mudam antes da coluna.
drop function public.get_public_videos();

alter table public.videos drop column featured;

-- No máximo um principal (ativo ou não). É o que segura duas promoções simultâneas.
create unique index videos_single_main on public.videos ((true)) where placement = 'main';

comment on table public.videos is
  'Vídeos do site. placement: main (principal da Home), secondary (Home até o limite), gallery (só "Ver mais"). active = false tira do site.';
comment on column public.videos.placement is
  'Classificação editorial, independente da orientação. Só um vídeo pode ser main.';

create or replace function private.videos_before_write()
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

  new.title  := btrim(new.title);
  new.source := btrim(new.source);
  new.poster := nullif(btrim(new.poster), '');

  -- Mensagem clara antes do índice único (que continua valendo para concorrência).
  if new.placement = 'main'
     and (tg_op = 'INSERT' or old.placement is distinct from 'main')
     and exists (select 1 from public.videos v where v.placement = 'main' and v.id <> new.id) then
    raise exception 'Já existe um vídeo principal. Use "Tornar principal" para substituí-lo.'
      using errcode = 'AG006';
  end if;

  if tg_op = 'INSERT' then
    -- Novo vídeo entra no fim do seu grupo.
    new.position   := coalesce((select max(v.position) from public.videos v), 0) + 1;
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

  -- Mudou de classificação: vai para o fim do novo grupo.
  if new.placement is distinct from old.placement then
    new.position := coalesce((select max(v.position) from public.videos v), 0) + 1;
  end if;

  return new;
end;
$$;

-- Site público: só vídeos ativos e só o que a galeria exibe, na ordem de exibição.
create function public.get_public_videos()
returns table (
  id          uuid,
  title       text,
  source_type public.video_source,
  source      text,
  poster      text,
  orientation public.video_orientation,
  placement   public.video_placement
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.title, v.source_type, v.source, v.poster, v.orientation, v.placement
  from public.videos v
  where v.active
  order by v.position, v.created_at, v.id
$$;

-- Sobe/desce um vídeo uma posição dentro da própria classificação.
-- SECURITY INVOKER: o RLS de videos vale normalmente (só staff enxerga e edita).
create or replace function public.move_video(p_id uuid, p_direction text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_video    public.videos;
  v_neighbor public.videos;
begin
  if p_direction is null or p_direction not in ('up', 'down') then
    raise exception 'Direção inválida: use up ou down.' using errcode = '22023';
  end if;

  select * into v_video from public.videos where id = p_id for update;
  if not found then
    raise exception 'Vídeo não encontrado.' using errcode = '22023';
  end if;

  if p_direction = 'up' then
    select * into v_neighbor from public.videos
    where placement = v_video.placement and position < v_video.position
    order by position desc limit 1 for update;
  else
    select * into v_neighbor from public.videos
    where placement = v_video.placement and position > v_video.position
    order by position limit 1 for update;
  end if;

  -- Já é o primeiro/último do grupo: nada a fazer.
  if not found then
    return;
  end if;

  -- A unicidade de position é verificada no fim da transação (deferrable).
  update public.videos set position = v_neighbor.position where id = v_video.id;
  update public.videos set position = v_video.position where id = v_neighbor.id;
end;
$$;

-- Promove um vídeo ativo a principal. O principal anterior vira o PRIMEIRO secundário
-- (continua na Home). Serializado por advisory lock: duas trocas simultâneas não deixam
-- dois principais (e, se escapassem, o índice único barraria).
-- SECURITY INVOKER: o RLS de videos vale normalmente.
create function public.set_main_video(p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_video public.videos;
  v_previous uuid;
begin
  perform pg_advisory_xact_lock(hashtext('public.videos:main'));

  select * into v_video from public.videos where id = p_id for update;
  if not found then
    raise exception 'Vídeo não encontrado.' using errcode = '22023';
  end if;
  if not v_video.active then
    raise exception 'Ative o vídeo antes de torná-lo principal.' using errcode = '22023';
  end if;
  if v_video.placement = 'main' then
    return;
  end if;

  update public.videos set placement = 'secondary'
  where placement = 'main'
  returning id into v_previous;

  if v_previous is not null then
    -- Antes de todos (logo, o primeiro dos secundários).
    update public.videos
    set position = (select min(v.position) from public.videos v) - 1
    where id = v_previous;
  end if;

  update public.videos set placement = 'main' where id = p_id;
end;
$$;

revoke execute on function public.get_public_videos() from public;
grant execute on function public.get_public_videos() to anon, authenticated, service_role;

revoke execute on function public.set_main_video(uuid) from public, anon;
grant execute on function public.set_main_video(uuid) to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 3. Limites de vídeos na Home (desktop e celular)
-- -----------------------------------------------------------------------------
-- Uma linha só (id = true). Cada vídeo da Home conta 1, principal incluído.

create table public.video_settings (
  id                 boolean primary key default true,
  home_limit_desktop integer not null default 3,
  home_limit_mobile  integer not null default 3,
  updated_by         uuid references public.profiles (id) on delete restrict,
  updated_at         timestamptz not null default now(),

  constraint video_settings_singleton check (id),
  constraint video_settings_desktop_range check (home_limit_desktop between 1 and 12),
  constraint video_settings_mobile_range check (home_limit_mobile between 1 and 12)
);

comment on table public.video_settings is
  'Quantos vídeos a Home mostra no desktop e no celular (1 a 12, principal incluído). O restante vai para o "Ver mais".';

insert into public.video_settings (id) values (true) on conflict (id) do nothing;

create function private.video_settings_before_update()
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

create trigger video_settings_before_update
  before update on public.video_settings
  for each row execute function private.video_settings_before_update();

-- Site público: só os dois limites.
create function public.get_public_video_settings()
returns table (
  home_limit_desktop integer,
  home_limit_mobile  integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.home_limit_desktop, s.home_limit_mobile
  from public.video_settings s
  where s.id
$$;

alter table public.video_settings enable row level security;

revoke all on public.video_settings from anon;
-- Linha única criada aqui: o painel só lê e altera.
revoke insert, delete, truncate, references, trigger on public.video_settings from authenticated;

revoke execute on function public.get_public_video_settings() from public;
grant execute on function public.get_public_video_settings() to anon, authenticated, service_role;

revoke execute on function private.video_settings_before_update() from public, anon;

create policy "video_settings: staff lê"
  on public.video_settings for select to authenticated
  using ((select private.is_staff()));

create policy "video_settings: staff edita"
  on public.video_settings for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));
