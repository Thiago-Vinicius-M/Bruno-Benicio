"use server";

import { revalidatePath } from "next/cache";
import {
  createShowFromInput,
  deleteShowById,
  restoreShowById,
  setAgendaPublicFromInput,
  updateShowFromInput,
  type ShowActionResult,
} from "@/lib/painel/agenda";
import { PANEL_ROUTES } from "@/lib/painel/routes";
import { requirePanelStaff } from "@/lib/painel/session";
import type { AgendaClient } from "@/lib/supabase/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Operações de show. Cada Server Action é um endpoint público: exige sessão com
 * perfil ativo (ADMIN ou EDITOR, sem distinção) e roda com o cliente da sessão,
 * então o RLS e os triggers de auditoria do banco valem normalmente.
 * `revalidatePath` faz a lista voltar atualizada na mesma resposta e atualiza a Home
 * (seção AGENDA e o link na navegação).
 */

async function withSession(operation: (client: AgendaClient) => Promise<ShowActionResult>) {
  await requirePanelStaff();
  const result = await operation(await createSupabaseServerClient());
  if (result.status === "success") {
    revalidatePath(PANEL_ROUTES.agenda);
    revalidatePath("/");
  }
  return result;
}

export async function createShowAction(input: unknown): Promise<ShowActionResult> {
  return withSession((client) => createShowFromInput(client, input));
}

export async function updateShowAction(id: unknown, input: unknown): Promise<ShowActionResult> {
  return withSession((client) => updateShowFromInput(client, id, input));
}

export async function deleteShowAction(id: unknown): Promise<ShowActionResult> {
  return withSession((client) => deleteShowById(client, id));
}

export async function restoreShowAction(id: unknown): Promise<ShowActionResult> {
  return withSession((client) => restoreShowById(client, id));
}

/** Habilita/desabilita a agenda no site público. */
export async function setAgendaPublicAction(enabled: unknown): Promise<ShowActionResult> {
  return withSession((client) => setAgendaPublicFromInput(client, enabled));
}