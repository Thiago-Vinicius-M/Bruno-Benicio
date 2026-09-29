import type { GalleryVideo, VideoOrientation } from "./types";

/**
 * Composição da galeria — cada linha segue um template, e cada posição do template pede
 * uma orientação. O posicionamento na tela (colunas/áreas) fica no CSS, por template.
 *
 *   pair    → horizontal · horizontal
 *   feature → vertical · (horizontal / horizontal empilhados) · vertical
 */
export const ROW_TEMPLATES = {
  pair: ["landscape", "landscape"],
  feature: ["portrait", "landscape", "landscape", "portrait"],
} as const satisfies Record<string, readonly VideoOrientation[]>;

export type RowTemplate = keyof typeof ROW_TEMPLATES;

/** Sequência de linhas; repete enquanto houver vídeos para preenchê-la. */
export const DEFAULT_PATTERN: RowTemplate[] = ["pair", "feature"];

export type GalleryRow = {
  /** "rest" = sobras que não completam nenhum template (grade simples no fim) */
  template: RowTemplate | "rest";
  videos: GalleryVideo[];
};

/**
 * Distribui os vídeos pelas linhas do padrão. Horizontais preenchem as posições
 * horizontais na ordem da lista, e verticais, as verticais. Um template sem vídeos
 * suficientes é pulado; quando nenhum template fecha, o que sobrou vai para uma linha "rest".
 */
export function buildGalleryRows(videos: GalleryVideo[], pattern: RowTemplate[] = DEFAULT_PATTERN) {
  const queues: Record<VideoOrientation, GalleryVideo[]> = {
    landscape: videos.filter((video) => video.orientation === "landscape"),
    portrait: videos.filter((video) => video.orientation === "portrait"),
  };
  const rows: GalleryRow[] = [];

  let misses = 0;
  for (let i = 0; pattern.length && misses < pattern.length; i++) {
    const template = pattern[i % pattern.length];
    const slots = ROW_TEMPLATES[template];
    const fits = (["landscape", "portrait"] as const).every(
      (orientation) => queues[orientation].length >= slots.filter((slot) => slot === orientation).length,
    );

    if (!fits) {
      misses++;
      continue;
    }
    misses = 0;
    rows.push({ template, videos: slots.map((slot) => queues[slot].shift()!) });
  }

  const rest = videos.filter((video) => queues[video.orientation].includes(video));
  if (rest.length) rows.push({ template: "rest", videos: rest });

  return rows;
}
