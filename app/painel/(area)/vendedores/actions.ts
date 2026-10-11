"use server";

import { revalidatePath } from "next/cache";
import { PANEL_ROUTES } from "@/lib/painel/routes";
import {
  createSellerFromInput,
  setSellerActiveById,
  updateSellerFromInput,
  type SellerActionResult,
} from "@/lib/painel/sellers";
import { requirePanelAdmin } from "@/lib/painel/session";
import type { AgendaClient } from "@/lib/supabase/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Operações de vendedores. Cada Server Action começa por `requirePanelAdmin()` e roda
 * com o cliente da sessão (RLS e triggers valem). O site público não guarda nada dos
 * vendedores em cache (cada link e cada "Voltar ao WhatsApp" consultam o banco), então
 * só a lista do painel é revalidada.
 */

async function asAdmin(operation: (client: AgendaClient) => Promise<SellerActionResult>) {
  await requirePanelAdmin();
  const result = await operation(await createSupabaseServerClient());
  if (result.status === "success") revalidatePath(PANEL_ROUTES.sellers);
  return result;
}

export async function createSellerAction(input: unknown): Promise<SellerActionResult> {
  return asAdmin((client) => createSellerFromInput(client, input));
}

export async function updateSellerAction(id: unknown, input: unknown): Promise<SellerActionResult> {
  return asAdmin((client) => updateSellerFromInput(client, id, input));
}

export async function setSellerActiveAction(id: unknown, active: unknown): Promise<SellerActionResult> {
  return asAdmin((client) => setSellerActiveById(client, id, active));
}
