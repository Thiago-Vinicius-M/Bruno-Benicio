import type { GalleryVideo } from "@/components/VideoGallery/types";
import type { PublicVideo, Video, VideoHomeLimits } from "./types";

/**
 * Regras de exibição dos vídeos: o que vai para a Home e o que fica no "Ver mais".
 * Um catálogo só (classificação e ordem do painel); só o limite muda por dispositivo.
 *
 *   1. só vídeos ativos (o site público já recebe só eles);
 *   2. o principal, se houver, ocupa a primeira posição;
 *   3. os secundários seguem, na ordem do painel;
 *   4. corta no limite do dispositivo (cada vídeo conta 1, principal incluído);
 *   5. o "Ver mais" recebe o que sobrou (na mesma ordem) e depois os "só no Ver mais".
 *
 * Nenhum vídeo se perde nem se repete: Home + "Ver mais" = todos os ativos.
 */

/** Faixa aceita pelos limites (o banco tem a mesma regra). */
export const HOME_LIMIT_RANGE = { min: 1, max: 12 } as const;

/** Sem configuração no banco: o comportamento anterior (3 destaques nos dois formatos). */
export const DEFAULT_HOME_LIMITS: VideoHomeLimits = { desktop: 3, mobile: 3 };

export type VideoCollection = {
  /** Vídeo principal ativo, se houver. */
  main: GalleryVideo | null;
  /** Secundários ativos, na ordem do painel. */
  secondary: GalleryVideo[];
  /** "Só no Ver mais" ativos, na ordem do painel. */
  galleryOnly: GalleryVideo[];
  limits: VideoHomeLimits;
};

export const EMPTY_COLLECTION: VideoCollection = {
  main: null,
  secondary: [],
  galleryOnly: [],
  limits: DEFAULT_HOME_LIMITS,
};

/** Linha do banco → item da galeria. YouTube guarda só o ID; a galeria aceita ID ou link. */
export function toGalleryVideo(video: PublicVideo | Video): GalleryVideo {
  return {
    id: video.id,
    type: "video",
    sourceType: video.source_type,
    orientation: video.orientation,
    title: video.title,
    source: video.source,
    thumbnail: video.poster ?? undefined,
  };
}

const isActive = (video: PublicVideo | Video) => !("active" in video) || video.active;

/**
 * Separa por classificação mantendo a ordem de exibição que veio do banco. Inativos
 * (só aparecem nas linhas do painel) ficam de fora.
 */
export function toVideoCollection(
  videos: (PublicVideo | Video)[],
  limits: VideoHomeLimits = DEFAULT_HOME_LIMITS,
): VideoCollection {
  const collection: VideoCollection = { main: null, secondary: [], galleryOnly: [], limits };
  for (const video of videos) {
    if (!isActive(video)) continue;
    const item = toGalleryVideo(video);
    if (video.placement === "main" && !collection.main) collection.main = item;
    // Um segundo principal não deveria existir (índice único); se vier, não some: vira secundário.
    else if (video.placement === "gallery") collection.galleryOnly.push(item);
    else collection.secondary.push(item);
  }
  return collection;
}

export type HomeSplit = { home: GalleryVideo[]; more: GalleryVideo[] };

/** Home e "Ver mais" para um limite (o do desktop ou o do celular). */
export function splitHomeVideos(collection: VideoCollection, limit: number): HomeSplit {
  const candidates = collection.main ? [collection.main, ...collection.secondary] : collection.secondary;
  const count = Math.max(0, Math.floor(limit));
  return {
    home: candidates.slice(0, count),
    more: [...candidates.slice(count), ...collection.galleryOnly],
  };
}

/** Limite vindo do banco/painel → inteiro dentro da faixa, ou null se inválido. */
export function parseHomeLimit(raw: unknown): number | null {
  const value = typeof raw === "string" && raw.trim() ? Number(raw) : raw;
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= HOME_LIMIT_RANGE.min && value <= HOME_LIMIT_RANGE.max ? value : null;
}
