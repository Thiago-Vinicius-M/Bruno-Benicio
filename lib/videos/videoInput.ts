import { validationError } from "@/lib/agenda/errors";
import { parseYouTubeId } from "@/components/VideoGallery/youtube";
import type { VideoInput } from "./types";

/**
 * Validação e normalização dos campos do vídeo para as colunas do banco. É a mesma no
 * formulário (antes de enviar arquivos) e no servidor; o banco continua sendo a
 * autoridade final (checks da migration).
 */

const VIDEO_FILE = /\.mp4$/i;
const IMAGE_FILE = /\.(jpe?g|png|webp|avif)$/i;

const safeDecode = (value: string) => {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
};

/**
 * Caminho no site ou URL https → forma pronta para usar como `src` (espaços e acentos
 * codificados, uma vez só). Aceita o caminho como aparece no projeto: "public/videos/x.mp4",
 * "videos/x.mp4" ou "/videos/x.mp4". Vazio → null. Inválido → undefined.
 */
export function normalizeMediaPath(value: string | null | undefined): string | null | undefined {
  const raw = value?.trim().replace(/\\/g, "/") ?? "";
  if (!raw) return null;

  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    if (!/^https:\/\//i.test(raw)) return undefined;
    try {
      return new URL(raw).href;
    } catch {
      return undefined;
    }
  }

  const path = `/${raw.replace(/^\/+/, "").replace(/^public\//i, "")}`;
  if (path.split("/").includes("..")) return undefined;
  return encodeURI(safeDecode(path));
}

/** Nome do arquivo (para os testes de extensão), já sem query/fragmento. */
const fileName = (src: string) => safeDecode(src.split(/[?#]/)[0]);

export type VideoRow = {
  title: string;
  source_type: VideoInput["sourceType"];
  source: string;
  poster: string | null;
  orientation: VideoInput["orientation"];
  placement: VideoInput["placement"];
};

const PLACEMENTS: readonly VideoInput["placement"][] = ["main", "secondary", "gallery"];

export function toVideoRow(input: VideoInput): VideoRow {
  const title = input.title?.trim() ?? "";
  if (!title) throw validationError("Informe o título do vídeo.");
  if (title.length > 160) throw validationError("Título muito longo (máx. 160 caracteres).");

  if (input.orientation !== "landscape" && input.orientation !== "portrait") {
    throw validationError("Escolha o formato do vídeo: horizontal ou vertical.");
  }

  if (!PLACEMENTS.includes(input.placement)) {
    throw validationError("Escolha onde o vídeo aparece: principal, secundário ou só no “Ver mais”.");
  }

  let source: string;
  if (input.sourceType === "youtube") {
    const id = parseYouTubeId(input.youtube ?? "");
    if (!id) throw validationError("Link do YouTube inválido. Copie o link do vídeo (ex.: https://youtu.be/...).");
    source = id;
  } else if (input.sourceType === "local") {
    const file = normalizeMediaPath(input.file);
    if (file === null) throw validationError("Envie o arquivo .mp4 ou informe o caminho dele.");
    if (file === undefined || !VIDEO_FILE.test(fileName(file))) {
      throw validationError("Arquivo de vídeo inválido: use um caminho ou link https terminado em .mp4.");
    }
    source = file;
  } else {
    throw validationError("Escolha a origem do vídeo: YouTube ou arquivo .mp4.");
  }

  const poster = normalizeMediaPath(input.poster);
  if (poster === undefined || (poster && !IMAGE_FILE.test(fileName(poster)))) {
    throw validationError("Imagem de capa inválida: use um caminho ou link https de uma imagem .jpg, .png ou .webp.");
  }

  return {
    title,
    source_type: input.sourceType,
    source,
    poster,
    orientation: input.orientation,
    placement: input.placement,
  };
}

/** Formato sugerido a partir do link do YouTube: Shorts são verticais. */
export const suggestedYouTubeOrientation = (link: string) =>
  /youtube\.com\/shorts\//i.test(link) ? ("portrait" as const) : ("landscape" as const);
