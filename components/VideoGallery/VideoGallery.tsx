"use client";

import { useState, type Ref } from "react";
import { buildGalleryRows, DEFAULT_PATTERN, type RowTemplate } from "./galleryLayout";
import type { GalleryVideo } from "./types";
import { VideoGalleryItem } from "./VideoGalleryItem";
import styles from "./VideoGallery.module.css";

type VideoGalleryProps = {
  videos: GalleryVideo[];
  /** sequência de linhas (galleryLayout.ts); repete até acabarem os vídeos */
  pattern?: RowTemplate[];
  /**
   * Com esta função o play é delegado (ex.: abrir um modal/lightbox) e o card não toca
   * sozinho. Sem ela, o vídeo toca dentro do próprio card.
   */
  onPlay?: (video: GalleryVideo) => void;
  /**
   * Destaques do celular (ids, na ordem de exibição): em telas ≤ 767px só eles aparecem,
   * nessa ordem, e os outros ficam ocultos (CSS). Tablet e desktop mostram todos. Sem
   * valor, o celular também mostra todos.
   */
  highlights?: readonly string[];
  /**
   * Tablet/desktop: mostra só as linhas completas (pair/feature) — vídeos que sobram e não
   * fecham um template (linha "rest") ficam ocultos, para a composição não ficar torta.
   * Use quando a galeria completa estiver em outro lugar (ex.: "Ver mais"). O celular não muda.
   */
  completeRowsOnly?: boolean;
  /** elemento raiz — ex.: alvo de uma animação GSAP */
  ref?: Ref<HTMLDivElement>;
  className?: string;
};

/**
 * Galeria editorial: horizontais e verticais mantêm a própria proporção. A composição
 * vem de buildGalleryRows (dados) + VideoGallery.module.css (posição de cada template).
 * Só um vídeo toca por vez: dar play em outro desmonta o player anterior.
 */
export function VideoGallery({
  videos,
  pattern = DEFAULT_PATTERN,
  onPlay,
  highlights,
  completeRowsOnly,
  ref,
  className,
}: VideoGalleryProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const rows = buildGalleryRows(videos, pattern);

  return (
    <div
      ref={ref}
      className={className ? `${styles.gallery} ${className}` : styles.gallery}
      data-highlights={highlights ? "" : undefined}
      data-complete-rows={completeRowsOnly ? "" : undefined}
    >
      {rows.map((row, rowIndex) => (
        <ul key={`${row.template}-${rowIndex}`} className={styles.row} data-template={row.template}>
          {row.videos.map((video, slot) => (
            <VideoGalleryItem
              key={video.id}
              video={video}
              slot={slot}
              highlight={highlights?.indexOf(video.id)}
              playing={playingId === video.id}
              onPlay={() => (onPlay ? onPlay(video) : setPlayingId(video.id))}
              onStop={() => setPlayingId(null)}
            />
          ))}
        </ul>
      ))}
    </div>
  );
}
