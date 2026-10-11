import { toAgendaError } from "@/lib/agenda/errors";
import type { AgendaClient } from "@/lib/supabase/client";
import { HOME_LIMIT_RANGE, parseHomeLimit } from "@/lib/videos/gallery";
import { removeUnusedAssets, replacedAssets } from "@/lib/videos/storage";
import type { VideoInput, VideoMoveDirection, VideoPlacement } from "@/lib/videos/types";
import {
  createVideo,
  deleteVideo,
  getVideo,
  moveVideo,
  setVideoActive,
  setVideoPlacement,
  updateVideo,
  updateVideoHomeLimits,
} from "@/lib/videos/videosRepository";

/**
 * Vídeos do painel: regras das operações. Tudo passa por lib/videos/videosRepository
 * (nenhuma chamada Supabase direta aqui); autoria e posição são definidas pelo banco.
 * ADMIN e EDITOR têm as mesmas permissões, como na Agenda.
 */

export type VideoActionResult = { status: "success"; message: string } | { status: "error"; message: string };

const PLACEMENTS: readonly VideoPlacement[] = ["main", "secondary", "gallery"];
const isPlacement = (value: unknown): value is VideoPlacement => PLACEMENTS.includes(value as VideoPlacement);

/**
 * Entrada vinda do navegador: só os campos do formulário. Qualquer outra propriedade
 * (created_by, position, active...) é descartada.
 */
export function parseVideoInput(raw: unknown): VideoInput {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (key: string) => (typeof source[key] === "string" ? (source[key] as string) : "");
  return {
    title: text("title"),
    sourceType: text("sourceType") as VideoInput["sourceType"],
    youtube: text("youtube"),
    file: text("file"),
    poster: text("poster"),
    orientation: text("orientation") as VideoInput["orientation"],
    placement: text("placement") as VideoInput["placement"],
  };
}

const isId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

async function run(operation: () => Promise<unknown>, success: string, fallback: string): Promise<VideoActionResult> {
  try {
    await operation();
    return { status: "success", message: success };
  } catch (error) {
    const videoError = toAgendaError(error);
    if (videoError.code === "UNKNOWN") {
      // Detalhe técnico só no log do servidor.
      console.error("[videos]", videoError.cause ?? videoError);
      return { status: "error", message: fallback };
    }
    return { status: "error", message: videoError.message };
  }
}

const invalidVideo: VideoActionResult = { status: "error", message: "Vídeo inválido." };
const SAVE_FAILED = "Não foi possível salvar o vídeo. Tente novamente.";

export const createVideoFromInput = (client: AgendaClient, raw: unknown) =>
  run(() => createVideo(client, parseVideoInput(raw)), "Vídeo adicionado.", SAVE_FAILED);

export const updateVideoFromInput = async (client: AgendaClient, id: unknown, raw: unknown) =>
  isId(id)
    ? run(
        async () => {
          const before = await getVideo(client, id);
          const after = await updateVideo(client, id, parseVideoInput(raw));
          await removeUnusedAssets(client, replacedAssets(before, after));
        },
        "Vídeo atualizado.",
        SAVE_FAILED,
      )
    : invalidVideo;

export const deleteVideoById = async (client: AgendaClient, id: unknown) =>
  isId(id)
    ? run(
        async () => {
          const deleted = await deleteVideo(client, id);
          await removeUnusedAssets(client, replacedAssets(deleted));
        },
        "Vídeo excluído.",
        "Não foi possível excluir o vídeo. Tente novamente.",
      )
    : invalidVideo;

const PLACEMENT_MESSAGES: Record<VideoPlacement, string> = {
  main: "Vídeo principal atualizado. O anterior passou a ser o primeiro secundário.",
  secondary: "Vídeo agora é secundário na Home.",
  gallery: "Vídeo movido para a galeria do “Ver mais”.",
};

export const setVideoPlacementById = async (client: AgendaClient, id: unknown, placement: unknown) =>
  isId(id) && isPlacement(placement)
    ? run(() => setVideoPlacement(client, id, placement), PLACEMENT_MESSAGES[placement], SAVE_FAILED)
    : invalidVideo;

export const setVideoActiveById = async (client: AgendaClient, id: unknown, active: unknown) =>
  isId(id) && typeof active === "boolean"
    ? run(
        () => setVideoActive(client, id, active),
        active ? "Vídeo ativado: voltou ao site." : "Vídeo desativado: saiu do site, mas continua cadastrado.",
        SAVE_FAILED,
      )
    : invalidVideo;

export const moveVideoById = async (client: AgendaClient, id: unknown, direction: unknown) =>
  isId(id) && (direction === "up" || direction === "down")
    ? run(
        () => moveVideo(client, id, direction as VideoMoveDirection),
        "Ordem atualizada.",
        "Não foi possível mudar a ordem. Tente novamente.",
      )
    : invalidVideo;

const LIMIT_PROBLEM = `Use um número inteiro de ${HOME_LIMIT_RANGE.min} a ${HOME_LIMIT_RANGE.max}.`;

export async function updateVideoHomeLimitsFromInput(client: AgendaClient, raw: unknown): Promise<VideoActionResult> {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const desktop = parseHomeLimit(source.desktop);
  const mobile = parseHomeLimit(source.mobile);
  if (desktop === null) return { status: "error", message: `Limite do desktop inválido. ${LIMIT_PROBLEM}` };
  if (mobile === null) return { status: "error", message: `Limite do celular inválido. ${LIMIT_PROBLEM}` };
  return run(
    () => updateVideoHomeLimits(client, { desktop, mobile }),
    "Limites da Home atualizados.",
    "Não foi possível salvar os limites. Tente novamente.",
  );
}
