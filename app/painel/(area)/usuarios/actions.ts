"use server";

import { revalidatePath } from "next/cache";
import type { UserAdminClients } from "@/lib/agenda/usersAdmin";
import { authCallbackUrl, INVITE_NEXT } from "@/lib/painel/authCallback";
import { PANEL_ROUTES } from "@/lib/painel/routes";
import { requirePanelAdmin } from "@/lib/painel/session";
import {
  changeMemberRole,
  deactivateMember,
  inviteMember,
  reactivateMember,
  renameMember,
  type UserActionResult,
} from "@/lib/painel/users";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Operações de usuários. Server Actions são endpoints públicos: cada uma começa por
 * `requirePanelAdmin()` (sessão + perfil ativo + ADMIN, lidos do servidor). EDITOR,
 * desativado ou visitante são redirecionados antes de qualquer acesso ao banco ou à
 * API admin do Auth. A secret key só existe aqui no servidor (lib/supabase/admin.ts).
 */

async function asAdmin(operation: (clients: UserAdminClients) => Promise<UserActionResult>) {
  await requirePanelAdmin();
  const clients = { caller: await createSupabaseServerClient(), admin: createSupabaseAdminClient() };
  const result = await operation(clients);
  if (result.status === "success") revalidatePath(PANEL_ROUTES.users);
  return result;
}

export async function inviteUserAction(input: unknown): Promise<UserActionResult> {
  return asAdmin(async (clients) => inviteMember(clients, input, await authCallbackUrl(INVITE_NEXT)));
}

export async function renameUserAction(id: unknown, name: unknown): Promise<UserActionResult> {
  return asAdmin((clients) => renameMember(clients, id, name));
}

export async function changeUserRoleAction(id: unknown, role: unknown): Promise<UserActionResult> {
  return asAdmin((clients) => changeMemberRole(clients, id, role));
}

export async function deactivateUserAction(id: unknown): Promise<UserActionResult> {
  return asAdmin((clients) => deactivateMember(clients, id));
}

export async function reactivateUserAction(id: unknown): Promise<UserActionResult> {
  return asAdmin((clients) => reactivateMember(clients, id));
}
