"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/painel/actionResult";
import {
  activateChannelById,
  createChannelFromInput,
  deactivateChannelById,
  updateChannelFromInput,
} from "@/lib/painel/commercialLinks";
import { PANEL_ROUTES } from "@/lib/painel/routes";
import { requirePanelAdmin } from "@/lib/painel/session";
import type { AgendaClient } from "@/lib/supabase/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * WhatsApp dos links comerciais, em Configurações. Só ADMIN (conferido no servidor antes
 * de tudo) e só os canais que ele cadastrou (RLS da migration 20261020120000). Roda com o
 * cliente da sessão: RLS e trigger repetem as regras. Os links comerciais também são
 * revalidados, porque o formulário de novo link lista os WhatsApp do usuário.
 */

async function asAdmin(operation: (client: AgendaClient) => Promise<ActionResult>): Promise<ActionResult> {
  await requirePanelAdmin();
  const result = await operation(await createSupabaseServerClient());
  if (result.status === "success") {
    revalidatePath(PANEL_ROUTES.settings);
    revalidatePath(PANEL_ROUTES.commercialLinks);
  }
  return result;
}

export async function createChannelAction(input: unknown): Promise<ActionResult> {
  return asAdmin((client) => createChannelFromInput(client, input));
}

export async function updateChannelAction(id: unknown, input: unknown): Promise<ActionResult> {
  return asAdmin((client) => updateChannelFromInput(client, id, input));
}

export async function deactivateChannelAction(id: unknown, redirectTo: unknown): Promise<ActionResult> {
  return asAdmin((client) => deactivateChannelById(client, id, redirectTo));
}

export async function activateChannelAction(id: unknown): Promise<ActionResult> {
  return asAdmin((client) => activateChannelById(client, id));
}
