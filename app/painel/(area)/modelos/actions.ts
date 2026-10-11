"use server";

import { revalidatePath } from "next/cache";
import { PANEL_ROUTES } from "@/lib/painel/routes";
import { requirePanelAdmin } from "@/lib/painel/session";
import {
  createShowModelFromInput,
  moveShowModelById,
  setShowModelActiveById,
  updateShowModelFromInput,
  type ShowModelActionResult,
} from "@/lib/painel/showModels";
import type { AgendaClient } from "@/lib/supabase/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Operações de modelos de show. Cada Server Action é um endpoint público: começa por
 * `requirePanelAdmin()` (sessão + perfil ativo + ADMIN, lidos do servidor) e roda com o
 * cliente da sessão (RLS e triggers valem). `revalidatePath("/")` publica a alteração
 * na seção NOSSO SHOW sem novo deploy.
 */

async function asAdmin(operation: (client: AgendaClient) => Promise<ShowModelActionResult>) {
  await requirePanelAdmin();
  const result = await operation(await createSupabaseServerClient());
  if (result.status === "success") {
    revalidatePath(PANEL_ROUTES.showModels);
    revalidatePath("/");
  }
  return result;
}

export async function createShowModelAction(input: unknown): Promise<ShowModelActionResult> {
  return asAdmin((client) => createShowModelFromInput(client, input));
}

export async function updateShowModelAction(id: unknown, input: unknown): Promise<ShowModelActionResult> {
  return asAdmin((client) => updateShowModelFromInput(client, id, input));
}

export async function setShowModelActiveAction(id: unknown, active: unknown): Promise<ShowModelActionResult> {
  return asAdmin((client) => setShowModelActiveById(client, id, active));
}

export async function moveShowModelAction(id: unknown, direction: unknown): Promise<ShowModelActionResult> {
  return asAdmin((client) => moveShowModelById(client, id, direction));
}
