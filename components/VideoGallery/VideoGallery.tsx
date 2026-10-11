"use client";

import { useState, type CSSProperties, type Ref } from "react";
import { buildLeadRows, LAYOUT, unitAspect, unitVideos, type GalleryRow, type LayoutUnit } from "./galleryLayout";
import type { GalleryVideo } from "./types";
import { VideoGalleryItem } from "./VideoGalleryItem";
import styles from "./VideoGallery.module.css";

type VideoGalleryProps = {
  videos: GalleryVideo[];
  /**
   * Com esta função o play é delegado (ex.: abrir um modal/lightbox) e o card não toca
   * sozinho. Sem ela, o vídeo toca dentro do próprio card.
   */
  onPlay?: (video: GalleryVideo) => void;
  /**
   * Home: quantos dos primeiros vídeos aparecem no desktop/tablet (≥ 768px) e no celular.
   * A lista traz o maior dos dois; o que sobra num dispositivo some só por CSS (o HTML é o
   * mesmo no servidor e no navegador). Sem valor: todos.
   */
  desktopCount?: number;
  mobileCount?: number;
  /** Vídeo principal (primeiro da lista): a composição se adapta à orientação dele. */
  leadId?: string;
  /** elemento raiz — ex.: alvo de uma animação GSAP */
  ref?: Ref<HTMLDivElement>;
  className?: string;
};

/** Largura máxima da galeria (--container-narrow-max): acima dela, `sizes` em px. */
const GALLERY_MAX_PX = 1080;

/** `sizes` da thumbnail: largura da coluna do card na linha (celular: tela inteira). */
function thumbnailSizes(row: GalleryRow, unit: LayoutUnit) {
  const fraction = ((1 - (row.units.length - 1) * LAYOUT.gap) * unitAspect(unit)) / row.aspect;
  return `(max-width: 767px) 100vw, (max-width: ${GALLERY_MAX_PX + 60}px) ${Math.ceil(fraction * 100)}vw, ${Math.ceil(fraction * GALLERY_MAX_PX)}px`;
}

/**
 * Galeria de vídeos. A composição vem de buildLeadRows/buildGalleryRows (galleryLayout.ts):
 * linhas na ordem da lista, com colunas proporcionais ao formato de cada card — todos da
 * linha com a mesma altura. O CSS só aplica as colunas e a posição de cada card (variáveis
 * abaixo). Só um vídeo toca por vez: dar play em outro desmonta o player anterior.
 */
export function VideoGallery({ videos, onPlay, desktopCount, mobileCount, leadId, ref, className }: VideoGalleryProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);

  const desktopVideos = videos.slice(0, desktopCount ?? videos.length);
  // Só no celular: o limite do celular é maior que o do desktop.
  const mobileExtra = videos.slice(desktopVideos.length);
  const mobileLimit = mobileCount ?? videos.length;
  const indexOf = new Map(videos.map((video, index) => [video.id, index]));
  const hiddenOnMobile = (video: GalleryVideo) => indexOf.get(video.id)! >= mobileLimit;

  const rows = buildLeadRows(desktopVideos, leadId);

  const item = (video: GalleryVideo, row: GalleryRow | null, unit: LayoutUnit, column: number, level: number) => {
    const stacked = row?.units.some((candidate) => candidate.kind === "stack") ?? false;
    return (
      <VideoGalleryItem
        key={video.id}
        video={video}
        stacked={unit.kind === "stack"}
        mobileHidden={hiddenOnMobile(video)}
        // posição no grid da linha (só tablet/desktop — no celular é uma coluna)
        gridStyle={
          {
            "--col": column + 1,
            "--row": unit.kind === "stack" ? level + 1 : stacked ? "1 / span 2" : 1,
          } as CSSProperties
        }
        sizes={row ? thumbnailSizes(row, unit) : "100vw"}
        playing={playingId === video.id}
        onPlay={() => (onPlay ? onPlay(video) : setPlayingId(video.id))}
        onStop={() => setPlayingId(null)}
      />
    );
  };

  return (
    <div ref={ref} className={className ? `${styles.gallery} ${className}` : styles.gallery}>
      {rows.map((row) => {
        const stacked = row.units.some((unit) => unit.kind === "stack");
        const rowStyle = {
          "--row-columns": row.units.map((unit) => `${unitAspect(unit).toFixed(4)}fr`).join(" "),
          "--row-aspect": row.aspect.toFixed(4),
          "--row-gaps": row.units.length - 1,
          "--row-scale": ((row.maxHeight ?? LAYOUT.maxRowHeight) / LAYOUT.maxRowHeight).toFixed(4),
        } as CSSProperties;
        const rowVideos = row.units.flatMap(unitVideos);

        return (
          <ul
            key={rowVideos[0].id}
            className={styles.row}
            style={rowStyle}
            data-stacked={stacked || undefined}
            data-mobile-hidden={rowVideos.every(hiddenOnMobile) || undefined}
          >
            {row.units.flatMap((unit, column) => unitVideos(unit).map((video, level) => item(video, row, unit, column, level)))}
          </ul>
        );
      })}
      {mobileExtra.length > 0 && (
        <ul className={styles.row} data-desktop-hidden>
          {mobileExtra.map((video) => item(video, null, { kind: "single", video }, 0, 0))}
        </ul>
      )}
    </div>
  );
}
