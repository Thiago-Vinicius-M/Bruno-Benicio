-- =============================================================================
-- Vídeos do site (seção VIDEOS da Home e galeria do "Ver mais"), editados pelo painel
--
--   * featured = true  → aparece na Home ("Em destaque"). Sempre há pelo menos um
--                         destaque enquanto existir algum vídeo (AG005).
--   * featured = false → aparece só na galeria completa ("Ver mais").
--   * position          → ordem de exibição (crescente) dentro de cada grupo. Quem
--                         muda de grupo vai para o fim do novo grupo.
--   * source            → YouTube: só o ID do vídeo (11 caracteres).
--                         Arquivo: caminho no site (/videos/arquivo.mp4, já codificado
--                         para URL) ou URL https (upload no Storage, bucket "videos").
--   * Site público lê somente public.get_public_videos(). anon não acessa a tabela.
--   * Mesmas convenções da Agenda: auditoria por trigger a partir de auth.uid(),
--     ADMIN e EDITOR ativos com as mesmas permissões.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tipos e tabela
-- -----------------------------------------------------------------------------

create type public.video_source as enum ('youtube', 'local');

create type public.video_orientation as enum ('landscape', 'portrait');

create table public.videos (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  source_type public.video_source not null,
  source      text not null,
  poster      text,
  orientation public.video_orientation not null,
  featured    boolean not null default false,
  -- Default só para os tipos gerados tratarem como opcional; o trigger define a posição.
  position    integer not null default 0,
  -- Nulos apenas nos vídeos importados por esta migration (antes do painel).
  created_by  uuid references public.profiles (id) on delete restrict,
  updated_by  uuid references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint videos_title_not_blank check (char_length(btrim(title)) between 1 and 160),
  constraint videos_youtube_id check (source_type <> 'youtube' or source ~ '^[A-Za-z0-9_-]{11}$'),
  -- Caminho do próprio site ou https; sem espaços (a aplicação codifica para URL).
  constraint videos_local_source check (source_type <> 'local' or source ~ '^(/|https://)\S+$'),
  constraint videos_poster check (poster is null or poster ~ '^(/|https://)\S+$'),
  constraint videos_position_unique unique (position) deferrable initially deferred,
  constraint videos_timestamps check (updated_at >= created_at)
);

comment on table public.videos is
  'Vídeos do site. featured = Home; os demais aparecem no "Ver mais". Ordem por position.';
comment on column public.videos.source is
  'YouTube: ID do vídeo. Arquivo: caminho no site (/videos/...) ou URL https do Storage.';


-- -----------------------------------------------------------------------------
-- 2. Funções
-- -----------------------------------------------------------------------------

-- Site público: somente o que a galeria exibe, na ordem de exibição.
create function public.get_public_videos()
returns table (
  id          uuid,
  title       text,
  source_type public.video_source,
  source      text,
  poster      text,
  orientation public.video_orientation,
  featured    boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.title, v.source_type, v.source, v.poster, v.orientation, v.featured
  from public.videos v
  order by v.position, v.created_at
$$;

-- Sobe/desce um vídeo uma posição dentro do próprio grupo (destaques ou galeria).
-- SECURITY INVOKER: o RLS de videos vale normalmente (só staff enxerga e edita).
create function public.move_video(p_id uuid, p_direction text)
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
    where featured = v_video.featured and position < v_video.position
    order by position desc limit 1 for update;
  else
    select * into v_neighbor from public.videos
    where featured = v_video.featured and position > v_video.position
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


-- -----------------------------------------------------------------------------
-- 3. Triggers (auditoria, posição e a regra do destaque)
-- -----------------------------------------------------------------------------

create function private.videos_before_write()
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

  -- Entrou ou saiu dos destaques: vai para o fim do novo grupo.
  if new.featured is distinct from old.featured then
    new.position := coalesce((select max(v.position) from public.videos v), 0) + 1;
  end if;

  return new;
end;
$$;

-- Os destaques são o que a Home mostra: com qualquer vídeo cadastrado, pelo menos um
-- precisa estar em destaque. Por comando (não por linha), para valer após a operação toda.
create function private.videos_require_featured()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.videos)
     and not exists (select 1 from public.videos where featured) then
    raise exception 'Mantenha pelo menos um vídeo em destaque: são eles que aparecem na Home.'
      using errcode = 'AG005';
  end if;
  return null;
end;
$$;

create trigger videos_before_write
  before insert or update on public.videos
  for each row execute function private.videos_before_write();

create trigger videos_require_featured
  after insert or update or delete on public.videos
  for each statement execute function private.videos_require_featured();


-- -----------------------------------------------------------------------------
-- 4. Privilégios e RLS
-- -----------------------------------------------------------------------------

alter table public.videos enable row level security;

revoke all on public.videos from anon;
revoke truncate, references, trigger on public.videos from authenticated;

revoke execute on function public.get_public_videos() from public;
grant execute on function public.get_public_videos() to anon, authenticated, service_role;

revoke execute on function public.move_video(uuid, text) from public, anon;
grant execute on function public.move_video(uuid, text) to authenticated, service_role;

revoke execute on function private.videos_before_write(), private.videos_require_featured() from public, anon;

create policy "videos: staff lê"
  on public.videos for select to authenticated
  using ((select private.is_staff()));

create policy "videos: staff cria"
  on public.videos for insert to authenticated
  with check ((select private.is_staff()));

create policy "videos: staff edita"
  on public.videos for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

-- Vídeo não tem histórico a preservar: exclusão física.
create policy "videos: staff exclui"
  on public.videos for delete to authenticated
  using ((select private.is_staff()));


-- -----------------------------------------------------------------------------
-- 5. Storage: bucket público "videos" (mp4 e pôsteres enviados pelo painel)
-- -----------------------------------------------------------------------------
-- Leitura pública pela URL (bucket public); envio e exclusão só por staff ativo.
-- 50 MB é o limite por arquivo do plano gratuito do Supabase.
-- O bloco é ignorado onde não há Storage (testes do banco em PGlite).

do $storage$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('videos', 'videos', true, 52428800, array['video/mp4', 'image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute $sql$
    create policy "videos storage: staff lê" on storage.objects for select to authenticated
    using (bucket_id = 'videos' and (select private.is_staff()))
  $sql$;
  execute $sql$
    create policy "videos storage: staff envia" on storage.objects for insert to authenticated
    with check (bucket_id = 'videos' and (select private.is_staff()))
  $sql$;
  execute $sql$
    create policy "videos storage: staff exclui" on storage.objects for delete to authenticated
    using (bucket_id = 'videos' and (select private.is_staff()))
  $sql$;
end;
$storage$;


-- -----------------------------------------------------------------------------
-- 6. Vídeos que já estavam no site (antes listados em components/Videos/videoList.ts)
-- -----------------------------------------------------------------------------
-- Uma instrução só: a regra do destaque é checada no fim do comando.

insert into public.videos (title, source_type, source, poster, orientation, featured)
select title, source_type::public.video_source, source, poster, orientation::public.video_orientation, featured
from (values
  -- Home
  (1, 'Conheça nosso show', 'local', '/videos/BeB-conhec%CC%A7a-nosso-show.mp4', '/videos/BeB-conhe%C3%A7a-nosso-showThumb.jpg', 'portrait', true),
  (2, 'Foi Deus (AO VIVO)', 'youtube', 'TDqHMUM0Z4k', null, 'landscape', true),
  (3, 'SÓ PRO MEU PRAZER (AO VIVO)', 'youtube', 'wIpRwHLWECw', null, 'landscape', true),
  -- Ver mais
  (4, 'POT-POURRI MANEIRA ERRADA / QUEM DE NOS DOIS', 'youtube', 'b-5AnnoJeg4', null, 'landscape', false),
  (5, 'AMIGO', 'youtube', 'pbfAmBaOKCk', null, 'landscape', false),
  (6, 'Só da você na minha vida', 'local', '/videos/So%20Da%20Voc%C3%AA%20Na%20Minha%20Vida.mp4', '/videos/So%20Da%20Voc%C3%AA%20Na%20Minha%20Vida%20Thumb.jpg', 'portrait', false),
  (7, 'Ela é demais', 'local', '/videos/Ela%20e%20demais.mp4', '/videos/Ela%20e%20demaisTHUMB.jpg', 'portrait', false)
) as seed (ord, title, source_type, source, poster, orientation, featured)
order by ord;
