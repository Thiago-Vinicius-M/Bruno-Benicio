import type { CSSProperties } from "react";
import { buildLeadRows, LAYOUT, unitVideos } from "@/components/VideoGallery/galleryLayout";
import type { GalleryVideo } from "@/components/VideoGallery/types";
import { resolveThumbnail } from "@/components/VideoGallery/videoSources";
import css from "./Videos.module.css";

type Props = {
  videos: GalleryVideo[];
  label: string;
  /** Vídeo principal (primeiro da lista): mesma composição da Home. */
  leadId?: string;
  note?: string;
};

/**
 * Miniatura da grade como ela sai no site (tablet/desktop), com o mesmo algoritmo da
 * galeria (galleryLayout.ts). Os números são a ordem de exibição.
 */
export function LayoutPreview({ videos, label, leadId, note = "No celular, uma coluna na mesma ordem." }: Props) {
  if (!videos.length) return null;
  const order = new Map(videos.map((video, index) => [video.id, index + 1]));

  return (
    <figure className={css.preview}>
      <figcaption className={css.previewCaption}>{label}</figcaption>
      <div className={css.previewCanvas} aria-hidden="true">
        {buildLeadRows(videos, leadId).map((row) => {
          const stacked = row.units.some((unit) => unit.kind === "stack");
          return (
            <div
              key={unitVideos(row.units[0])[0].id}
              className={css.previewRow}
              data-stacked={stacked || undefined}
              style={
                {
                  "--row-columns": row.columns.map((fraction) => `${fraction.toFixed(4)}fr`).join(" "),
                  "--row-aspect": row.aspect.toFixed(4),
                  "--row-gaps": row.units.length - 1,
                  "--row-scale": ((row.maxHeight ?? LAYOUT.maxRowHeight) / LAYOUT.maxRowHeight).toFixed(4),
                } as CSSProperties
              }
            >
              {row.units.flatMap((unit, column) =>
                unitVideos(unit).map((video, level) => {
                  const thumbnail = resolveThumbnail(video);
                  const src = typeof thumbnail === "string" ? thumbnail : thumbnail?.src;
                  return (
                    <span
                      key={video.id}
                      className={css.previewItem}
                      data-orientation={video.orientation}
                      data-stacked={unit.kind === "stack" || undefined}
                      data-lead={video.id === leadId || undefined}
                      style={
                        {
                          "--col": column + 1,
                          "--row": unit.kind === "stack" ? level + 1 : stacked ? "1 / span 2" : 1,
                          backgroundImage: src ? `url("${src}")` : undefined,
                        } as CSSProperties
                      }
                    >
                      <span className={css.previewNumber}>{order.get(video.id)}</span>
                    </span>
                  );
                }),
              )}
            </div>
          );
        })}
      </div>
      {note && <p className={css.previewNote}>{note}</p>}
    </figure>
  );
}
