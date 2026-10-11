"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import type { GalleryVideo } from "./types";
import { canPlay, isOptimizableImage, resolveThumbnail, VideoPlayer } from "./videoSources";
import styles from "./VideoGallery.module.css";

type VideoGalleryItemProps = {
  video: GalleryVideo;
  /** metade de uma pilha (dois horizontais um em cima do outro): ocupa a altura que sobrar */
  stacked?: boolean;
  /** coluna/linha no grid da linha (--col, --row), definidas pela galeria */
  gridStyle?: CSSProperties;
  /** `sizes` da thumbnail (largura do card na linha) */
  sizes: string;
  /** fora do limite da Home no celular: some só no celular (CSS) */
  mobileHidden?: boolean;
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
};

const ORIENTATION_LABEL = {
  landscape: "Horizontal · 16:9",
  portrait: "Vertical · 9:16",
} as const;

/**
 * Card de vídeo, em camadas (de baixo para cima):
 *   media   → thumbnail, ou o placeholder enquanto não há thumbnail
 *   scrim   → degradê que garante contraste para o texto
 *   info    → categoria + título
 *   play    → botão que cobre o card inteiro (clique em qualquer ponto, foco via teclado)
 * Tocando, as camadas dão lugar ao player da fonte do vídeo.
 */
export function VideoGalleryItem({
  video,
  stacked,
  gridStyle,
  sizes,
  mobileHidden,
  playing,
  onPlay,
  onStop,
}: VideoGalleryItemProps) {
  const playable = canPlay(video);
  const thumbnail = resolveThumbnail(video);
  const poster = typeof thumbnail === "string" ? thumbnail : thumbnail?.src;

  return (
    <li
      className={styles.item}
      data-orientation={video.orientation}
      data-stacked={stacked || undefined}
      data-playable={playable}
      data-mobile-hidden={mobileHidden || undefined}
      style={gridStyle}
      data-reveal="video"
    >
      {playing && playable ? (
        <VideoPlayer video={video} poster={poster} onEnded={onStop} />
      ) : (
        <>
          <div className={styles.media} aria-hidden="true">
            {thumbnail ? (
              <Image
                src={thumbnail}
                alt=""
                fill
                sizes={sizes}
                // Pôster em outro domínio (link colado no painel): exibido como está, sem otimização.
                unoptimized={!isOptimizableImage(thumbnail)}
                className={styles.thumbnail}
              />
            ) : playable && video.sourceType === "local" ? (
              // Arquivo sem poster: o primeiro quadro do vídeo serve de thumbnail (só os metadados são baixados).
              <video
                className={styles.framePreview}
                src={`${video.source}#t=0.1`}
                preload="metadata"
                muted
                playsInline
                tabIndex={-1}
              />
            ) : (
              <div className={styles.placeholder}>
                <span className={styles.placeholderLabel}>{ORIENTATION_LABEL[video.orientation]}</span>
                <span className={styles.placeholderHint}>thumbnail</span>
              </div>
            )}
          </div>

          <span className={styles.scrim} aria-hidden="true" />

          <div className={styles.info}>
            {video.category ? <p className={`type-nav ${styles.category}`}>{video.category}</p> : null}
            <h3 className={`type-caption ${styles.itemTitle}`}>{video.title}</h3>
          </div>

          <button
            type="button"
            className={styles.play}
            onClick={playable ? onPlay : undefined}
            aria-disabled={!playable}
            aria-label={playable ? `Reproduzir vídeo: ${video.title}` : `Vídeo em breve: ${video.title}`}
          >
            <span className={styles.playIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </span>
          </button>
        </>
      )}
    </li>
  );
}
