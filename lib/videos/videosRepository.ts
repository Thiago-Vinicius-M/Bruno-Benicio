import { toAgendaError, unwrap } from "@/lib/agenda/errors";
import type { AgendaClient } from "@/lib/supabase/client";
import type { PublicVideo, Video, VideoHomeLimits, VideoInput, VideoMoveDirection, VideoPlacement } from "./types";
import { toVideoRow } from "./videoInput";

/**
 * Vídeos do painel (ADMIN e EDITOR). Autoria, timestamps e posição são definidos pelo
 * banco (trigger); este módulo nunca envia created_by/updated_by/position.
 * Recebe o cliente por parâmetro: funciona com o cliente do navegador ou do servidor.
 */

const VIDEO_COLUMNS =
  "id, title, source_type, source, poster, orientation, placement, active, position, created_by, updated_by, created_at, updated_at";

const NOT_FOUND = "Vídeo não encontrado.";

/** Todos os vídeos (ativos e inativos), na ordem de exibição (o painel separa por classificação). */
export async function listVideos(client: AgendaClient): Promise<Video[]> {
  const { data, error } = await client
    .from("videos")
    .select(VIDEO_COLUMNS)
    .order("position")
    .order("created_at")
    .order("id");
  if (error) throw toAgendaError(error);
  return data;
}

export async function getVideo(client: AgendaClient, id: string): Promise<Video> {
  return unwrap(await client.from("videos").select(VIDEO_COLUMNS).eq("id", id).single(), NOT_FOUND);
}

/**
 * Cadastro. Um vídeo novo marcado como principal entra como secundário e é promovido por
 * set_main_video (que rebaixa o principal anterior na mesma transação).
 */
export async function createVideo(client: AgendaClient, input: VideoInput): Promise<Video> {
  const { placement, ...row } = toVideoRow(input);
  const created: Video = unwrap(
    await client
      .from("videos")
      .insert({ ...row, placement: placement === "main" ? "secondary" : placement })
      .select(VIDEO_COLUMNS)
      .single(),
  );
  if (placement !== "main") return created;
  await setMainVideo(client, created.id);
  return getVideo(client, created.id);
}

/**
 * Edição dos metadados e da classificação. Promover a principal passa por
 * set_main_video; o resto é um update simples (quem muda de grupo vai para o fim dele).
 */
export async function updateVideo(client: AgendaClient, id: string, input: VideoInput): Promise<Video> {
  const { placement, ...row } = toVideoRow(input);
  const current = await getVideo(client, id);
  const keepPlacement = placement === "main" && current.placement !== "main";
  const updated: Video = unwrap(
    await client
      .from("videos")
      .update(keepPlacement ? row : { ...row, placement })
      .eq("id", id)
      .select(VIDEO_COLUMNS)
      .single(),
    NOT_FOUND,
  );
  if (!keepPlacement) return updated;
  await setMainVideo(client, id);
  return getVideo(client, id);
}

/** Muda só a classificação (secundário ↔ "Ver mais", ou deixar de ser principal). */
export async function setVideoPlacement(client: AgendaClient, id: string, placement: VideoPlacement): Promise<Video> {
  if (placement === "main") {
    await setMainVideo(client, id);
    return getVideo(client, id);
  }
  return unwrap(
    await client.from("videos").update({ placement }).eq("id", id).select(VIDEO_COLUMNS).single(),
    NOT_FOUND,
  );
}

/** Troca o principal numa operação só: o anterior vira o primeiro secundário. */
export async function setMainVideo(client: AgendaClient, id: string): Promise<void> {
  const { error } = await client.rpc("set_main_video", { p_id: id });
  if (error) throw toAgendaError(error);
}

/** Inativo sai do site (Home e "Ver mais"), mas continua cadastrado com a classificação. */
export async function setVideoActive(client: AgendaClient, id: string, active: boolean): Promise<Video> {
  return unwrap(
    await client.from("videos").update({ active }).eq("id", id).select(VIDEO_COLUMNS).single(),
    NOT_FOUND,
  );
}

/** Exclusão física; devolve o vídeo apagado (para remover os arquivos enviados). */
export async function deleteVideo(client: AgendaClient, id: string): Promise<Video> {
  return unwrap(await client.from("videos").delete().eq("id", id).select(VIDEO_COLUMNS).single(), NOT_FOUND);
}

/** Sobe/desce uma posição dentro da própria classificação. */
export async function moveVideo(client: AgendaClient, id: string, direction: VideoMoveDirection): Promise<void> {
  const { error } = await client.rpc("move_video", { p_id: id, p_direction: direction });
  if (error) throw toAgendaError(error);
}

/** Limites da Home (painel). */
export async function getVideoHomeLimits(client: AgendaClient): Promise<VideoHomeLimits> {
  const row = unwrap(
    await client.from("video_settings").select("home_limit_desktop, home_limit_mobile").eq("id", true).single(),
    "Configuração dos vídeos não encontrada.",
  );
  return { desktop: row.home_limit_desktop, mobile: row.home_limit_mobile };
}

export async function updateVideoHomeLimits(client: AgendaClient, limits: VideoHomeLimits): Promise<VideoHomeLimits> {
  const row = unwrap(
    await client
      .from("video_settings")
      .update({ home_limit_desktop: limits.desktop, home_limit_mobile: limits.mobile })
      .eq("id", true)
      .select("home_limit_desktop, home_limit_mobile")
      .single(),
    "Configuração dos vídeos não encontrada.",
  );
  return { desktop: row.home_limit_desktop, mobile: row.home_limit_mobile };
}

/** Site público: somente `get_public_videos` (ativos, nada de auditoria). */
export async function getPublicVideos(client: AgendaClient): Promise<PublicVideo[]> {
  const { data, error } = await client.rpc("get_public_videos");
  if (error) throw toAgendaError(error, "Não foi possível carregar os vídeos.");
  return data;
}

/** Site público: limites da Home (null se a linha não existir). */
export async function getPublicVideoHomeLimits(client: AgendaClient): Promise<VideoHomeLimits | null> {
  const { data, error } = await client.rpc("get_public_video_settings");
  if (error) throw toAgendaError(error, "Não foi possível carregar os vídeos.");
  const row = data[0];
  return row ? { desktop: row.home_limit_desktop, mobile: row.home_limit_mobile } : null;
}
