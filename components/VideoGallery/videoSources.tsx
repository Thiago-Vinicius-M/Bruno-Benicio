"use client";

import { useEffect, useRef, type ComponentType } from "react";
import type { GalleryVideo, VideoSourceType } from "./types";
import { parseYouTubeId, youTubeEmbedUrl, youTubeThumbnailUrl } from "./youtube";
import styles from "./VideoGallery.module.css";

export type VideoPlayerProps = {
  video: GalleryVideo;
  /** URL da thumbnail, usada como poster enquanto o vídeo carrega */
  poster?: string;
  /** chamado quando o vídeo termina — o card volta para a thumbnail */
  onEnded: () => void;
};

type VideoSource = {
  Player: ComponentType<VideoPlayerProps>;
  /** o valor de `source` é válido para esta fonte */
  accepts: (source: string) => boolean;
  /** thumbnail automática quando o item não informa uma */
  thumbnail?: (source: string) => string | undefined;
};

/**
 * Fontes com player. Só existe player depois do clique no play: nada é baixado antes.
 * Nova fonte (ex.: Instagram) = um componente com VideoPlayerProps registrado aqui.
 */
export const VIDEO_SOURCES: Partial<Record<VideoSourceType, VideoSource>> = {
  local: { Player: LocalVideoPlayer, accepts: () => true },
  youtube: {
    Player: YouTubePlayer,
    accepts: (source) => parseYouTubeId(source) !== null,
    thumbnail: (source) => {
      const id = parseYouTubeId(source);
      return id ? youTubeThumbnailUrl(id) : undefined;
    },
  },
};

/** O vídeo tem arquivo/link válido e a fonte dele já tem player. */
export function canPlay(video: GalleryVideo) {
  const source = VIDEO_SOURCES[video.sourceType];
  return Boolean(video.source && source?.accepts(video.source));
}

/** Thumbnail do item, ou a automática da fonte (ex.: a do YouTube). */
export function resolveThumbnail(video: GalleryVideo) {
  if (video.thumbnail) return video.thumbnail;
  return video.source ? VIDEO_SOURCES[video.sourceType]?.thumbnail?.(video.source) : undefined;
}

/** Renderiza o player registrado para a fonte do vídeo (nada, se não houver). */
export function VideoPlayer(props: VideoPlayerProps) {
  const Player = VIDEO_SOURCES[props.video.sourceType]?.Player;
  return Player ? <Player {...props} /> : null;
}

/** Arquivo .mp4 servido pelo próprio site (pasta /public), com os controles nativos. */
function LocalVideoPlayer({ video, poster, onEnded }: VideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);

  // Montado pelo clique no play: começa a tocar e recebe o foco (teclado continua no vídeo).
  // Se o navegador bloquear o play, os controles nativos ficam visíveis para tocar.
  useEffect(() => {
    const player = ref.current;
    player?.focus();
    player?.play().catch(() => {});
  }, []);

  return (
    <video
      ref={ref}
      className={styles.player}
      src={video.source}
      poster={poster}
      aria-label={`Vídeo: ${video.title}`}
      controls
      tabIndex={0}
      playsInline
      preload="metadata"
      onEnded={onEnded}
    />
  );
}

/** Player oficial do YouTube embutido no card (controles, som e tela cheia do próprio YouTube). */
function YouTubePlayer({ video }: VideoPlayerProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const id = parseYouTubeId(video.source ?? "");

  useEffect(() => {
    ref.current?.focus();
  }, []);

  if (!id) return null;

  return (
    <iframe
      ref={ref}
      className={styles.player}
      src={youTubeEmbedUrl(id)}
      title={`Vídeo do YouTube: ${video.title}`}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
