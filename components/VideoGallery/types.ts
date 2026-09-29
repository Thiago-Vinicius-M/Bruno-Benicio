import type { StaticImageData } from "next/image";

export type VideoOrientation = "landscape" | "portrait";

/**
 * De onde o vídeo vem. Só "local" (arquivo .mp4 em /public) tem player hoje; as outras
 * fontes ganham player registrando um componente em videoSources.tsx.
 */
export type VideoSourceType = "local" | "instagram" | "youtube" | "vimeo";

export type GalleryVideo = {
  /** único na lista — também é a key do React */
  id: string;
  type: "video";
  /** "local": caminho a partir de /public (ex.: "/videos/foi-deus.mp4"). Sem valor = placeholder. */
  source?: string;
  sourceType: VideoSourceType;
  /** decide o formato do card: landscape = 16:9 · portrait = 9:16 */
  orientation: VideoOrientation;
  title: string;
  /** import estático (import thumb from "@/Imagens/x.jpg") ou caminho em /public */
  thumbnail?: StaticImageData | string;
  category?: string;
};
