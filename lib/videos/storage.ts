import type { AgendaClient } from "@/lib/supabase/client";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import type { Video } from "./types";

/**
 * Arquivos enviados pelo painel: bucket público "videos" do Supabase Storage (migration
 * 20261011120000_videos.sql). O navegador envia direto ao Storage com a sessão do
 * usuário — o arquivo não passa pelo servidor do site (sem limite de corpo da Vercel).
 */
export const VIDEO_BUCKET = "videos";

/** Limite por arquivo do bucket (plano gratuito do Supabase). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const UPLOAD_TYPES = {
  video: { folder: "arquivos", accept: ["video/mp4"], label: "vídeo .mp4" },
  poster: { folder: "capas", accept: ["image/jpeg", "image/png", "image/webp"], label: "imagem .jpg, .png ou .webp" },
} as const;

export type UploadKind = keyof typeof UPLOAD_TYPES;

const EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Mensagem de erro para o arquivo escolhido, ou null se pode ser enviado. */
export function uploadProblem(file: File, kind: UploadKind): string | null {
  const type = UPLOAD_TYPES[kind];
  if (!(type.accept as readonly string[]).includes(file.type)) return `Formato não aceito: envie um ${type.label}.`;
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(0);
    return `O arquivo tem ${mb} MB; o limite é ${MAX_UPLOAD_BYTES / 1024 / 1024} MB. Comprima o vídeo e tente de novo.`;
  }
  return null;
}

const publicPrefix = () => `${getSupabasePublicEnv().url}/storage/v1/object/public/${VIDEO_BUCKET}/`;

/** Envia o arquivo e devolve a URL pública (é ela que vai para o banco). */
export async function uploadVideoAsset(client: AgendaClient, file: File, kind: UploadKind): Promise<string> {
  const problem = uploadProblem(file, kind);
  if (problem) throw new Error(problem);

  const path = `${UPLOAD_TYPES[kind].folder}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  const { error } = await client.storage
    .from(VIDEO_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw error;
  return `${publicPrefix()}${path}`;
}

/** Caminho no bucket de uma URL enviada pelo painel; null para links/caminhos de fora. */
export function storagePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const prefix = publicPrefix();
  return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
}

/**
 * Apaga do bucket os arquivos que deixaram de ser usados (vídeo excluído ou arquivo
 * trocado na edição). Falhar aqui não desfaz a operação: no máximo sobra um arquivo.
 */
export async function removeUnusedAssets(client: AgendaClient, urls: (string | null | undefined)[]) {
  const paths = [...new Set(urls.map(storagePath).filter((path): path is string => Boolean(path)))];
  if (!paths.length) return;
  const { error } = await client.storage.from(VIDEO_BUCKET).remove(paths);
  if (error) console.error("[videos] não foi possível apagar arquivos do Storage", paths, error);
}

/** Arquivos de `before` que não aparecem mais em `after`. */
export const replacedAssets = (before: Video, after?: Pick<Video, "source" | "poster">) =>
  [before.source, before.poster].filter((url) => url && url !== after?.source && url !== after?.poster);
