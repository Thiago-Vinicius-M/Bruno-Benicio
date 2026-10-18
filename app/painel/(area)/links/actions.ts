"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/painel/actionResult";
import {
  createCommercialLinkFromInput,
  deactivateCommercialLinkById,
  type CreateCommercialLinkResult,
} from "@/lib/painel/commercialLinks";
import { PANEL_ROUTES } from "@/lib/painel/routes";
import { requirePanelLinkCreator } from "@/lib/painel/session";
import type { AgendaClient } from "@/lib/supabase/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Links comerciais. Cada Server Action confere o papel no servidor antes de tudo (ADMIN ou
 * SELLER) e roda com o cliente da sessão:
 * RLS, triggers e as funções do banco repetem as regras (dono do canal, permissão de
 * valores, quem pode desativar). O site público não guarda nada disso em cache.
 */

async function run<T extends ActionResult | CreateCommercialLinkResult>(
  authorize: () => Promise<unknown>,
  operation: (client: AgendaClient) => Promise<T>,
): Promise<T> {
  await authorize();
  const result = await operation(await createSupabaseServerClient());
  if (result.status === "success") revalidatePath(PANEL_ROUTES.commercialLinks);
  return result;
}

export async function createCommercialLinkAction(input: unknown): Promise<CreateCommercialLinkResult> {
  return run(requirePanelLinkCreator, (client) => createCommercialLinkFromInput(client, input));
}

export async function deactivateCommercialLinkAction(id: unknown): Promise<ActionResult> {
  return run(requirePanelLinkCreator, (client) => deactivateCommercialLinkById(client, id));
}
