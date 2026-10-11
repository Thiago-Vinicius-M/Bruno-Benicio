import type { Database, Enums, Tables } from "@/lib/supabase/database.types";

/** Tipos de domínio derivados dos tipos gerados do banco (não duplicar colunas aqui). */

export type Video = Tables<"videos">;
export type VideoSource = Enums<"video_source">;
export type VideoOrientationValue = Enums<"video_orientation">;
/**
 * Classificação editorial (independente da orientação):
 *   main      → vídeo principal da Home (no máximo um)
 *   secondary → Home, depois do principal, até o limite do dispositivo
 *   gallery   → só na galeria do "Ver mais"
 */
export type VideoPlacement = Enums<"video_placement">;

/** Vídeo como o site público o enxerga (get_public_videos): só ativos, sem auditoria nem posição. */
export type PublicVideo = Omit<Database["public"]["Functions"]["get_public_videos"]["Returns"][number], "poster"> & {
  // O gerador de tipos não conhece a nulidade de colunas de RETURNS TABLE.
  poster: string | null;
};

/** Quantos vídeos a Home mostra em cada dispositivo (principal incluído). */
export type VideoHomeLimits = { desktop: number; mobile: number };

/** Campos do formulário do painel. Ativar/desativar e "tornar principal" têm operação própria. */
export type VideoInput = {
  title: string;
  sourceType: VideoSource;
  /** YouTube: qualquer link do vídeo (watch, youtu.be, shorts...) ou só o ID. */
  youtube?: string | null;
  /** Arquivo: caminho no site (/videos/arquivo.mp4) ou URL https (upload do painel). */
  file?: string | null;
  /** Caminho ou URL da imagem de capa. Opcional (YouTube tem capa automática). */
  poster?: string | null;
  orientation: VideoOrientationValue;
  placement: VideoPlacement;
};

export type VideoMoveDirection = "up" | "down";
