"use server";

import { revalidatePath } from "next/cache";
import {
  createVideoFromInput,
  deleteVideoById,
  moveVideoById,
  setVideoActiveById,
  setVideoPlacementById,
  updateVideoFromInput,
  updateVideoHomeLimitsFromInput,
  type VideoActionResult,
} from "@/lib/painel/videos";
import { PANEL_ROUTES } from "@/lib/painel/routes";
import { requirePanelUser } from "@/lib/painel/session";
import type { AgendaClient } from "@/lib/supabase/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Operações de vídeo. Cada Server Action é um endpoint público: exige sessão com
 * perfil ativo (ADMIN ou EDITOR) e roda com o cliente da sessão (RLS e triggers valem).
 * Os arquivos já chegam enviados ao Storage pelo navegador; aqui só vão as URLs.
 * `revalidatePath` atualiza a lista do painel e a Home (seção VIDEOS e "Ver mais").
 */

async function withSession(operation: (client: AgendaClient) => Promise<VideoActionResult>) {
  await requirePanelUser();
  const result = await operation(await createSupabaseServerClient());
  if (result.status === "success") {
    revalidatePath(PANEL_ROUTES.videos);
    revalidatePath("/");
  }
  return result;
}

export async function createVideoAction(input: unknown): Promise<VideoActionResult> {
  return withSession((client) => createVideoFromInput(client, input));
}

export async function updateVideoAction(id: unknown, input: unknown): Promise<VideoActionResult> {
  return withSession((client) => updateVideoFromInput(client, id, input));
}

export async function deleteVideoAction(id: unknown): Promise<VideoActionResult> {
  return withSession((client) => deleteVideoById(client, id));
}

/** Principal, secundário ou só "Ver mais". Promover a principal rebaixa o anterior na mesma operação. */
export async function setVideoPlacementAction(id: unknown, placement: unknown): Promise<VideoActionResult> {
  return withSession((client) => setVideoPlacementById(client, id, placement));
}

export async function setVideoActiveAction(id: unknown, active: unknown): Promise<VideoActionResult> {
  return withSession((client) => setVideoActiveById(client, id, active));
}

export async function moveVideoAction(id: unknown, direction: unknown): Promise<VideoActionResult> {
  return withSession((client) => moveVideoById(client, id, direction));
}

/** Quantos vídeos a Home mostra no desktop e no celular. */
export async function updateVideoHomeLimitsAction(input: unknown): Promise<VideoActionResult> {
  return withSession((client) => updateVideoHomeLimitsFromInput(client, input));
}
