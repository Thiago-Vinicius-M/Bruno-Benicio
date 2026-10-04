import "server-only";
import { toAgendaError } from "@/lib/agenda/errors";
import type { Role } from "@/lib/agenda/types";
import {
  changeUserRole,
  deactivateUser,
  inviteUser,
  reactivateUser,
  renameUser,
  type UserAdminClients,
} from "@/lib/agenda/usersAdmin";
import { Constants } from "@/lib/supabase/database.types";

/**
 * Regras das operações de usuários do painel (exclusivas de ADMIN). A verificação de
 * ADMIN acontece em três camadas: a Server Action (`requirePanelAdmin`), cada função
 * de lib/agenda/usersAdmin (`requireAdmin`, lido do banco) e o RLS/trigger de profiles.
 * Aqui só entra validação da entrada e tradução de erros para mensagens ao usuário.
 */

export type UserActionResult = { status: "success"; message: string } | { status: "error"; message: string };

const GENERIC_ERROR = "Não foi possível realizar a operação.";
const INVALID_USER: UserActionResult = { status: "error", message: "Usuário inválido." };

const ROLES: readonly Role[] = Constants.public.Enums.app_role;

const isId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const isRole = (value: unknown): value is Role => typeof value === "string" && ROLES.includes(value as Role);

async function run(operation: () => Promise<unknown>, success: string): Promise<UserActionResult> {
  try {
    await operation();
    return { status: "success", message: success };
  } catch (error) {
    const agendaError = toAgendaError(error);
    if (agendaError.code === "UNKNOWN") {
      console.error("[usuarios]", agendaError.cause ?? agendaError);
      return { status: "error", message: GENERIC_ERROR };
    }
    return { status: "error", message: agendaError.message };
  }
}

/** Só nome, e-mail e papel; qualquer outro campo enviado pelo navegador é ignorado. */
export function parseInviteInput(raw: unknown): { name: string; email: string; role: Role } | { error: string } {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const email = typeof source.email === "string" ? source.email.trim().toLowerCase() : "";
  if (!name || name.length > 120) return { error: "Informe um nome com até 120 caracteres." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "E-mail inválido." };
  if (!isRole(source.role)) return { error: "Perfil inválido." };
  return { name, email, role: source.role };
}

export async function inviteMember(clients: UserAdminClients, raw: unknown, redirectTo: string) {
  const input = parseInviteInput(raw);
  if ("error" in input) return { status: "error", message: input.error } satisfies UserActionResult;
  return run(() => inviteUser(clients, { ...input, redirectTo }), "Usuário convidado com sucesso.");
}

export async function renameMember(clients: UserAdminClients, id: unknown, name: unknown) {
  if (!isId(id)) return INVALID_USER;
  return run(() => renameUser(clients, id, typeof name === "string" ? name : ""), "Usuário atualizado com sucesso.");
}

export async function changeMemberRole(clients: UserAdminClients, id: unknown, role: unknown) {
  if (!isId(id)) return INVALID_USER;
  if (!isRole(role)) return { status: "error", message: "Perfil inválido." } satisfies UserActionResult;
  return run(() => changeUserRole(clients, id, role), "Perfil atualizado com sucesso.");
}

export async function deactivateMember(clients: UserAdminClients, id: unknown) {
  return isId(id) ? run(() => deactivateUser(clients, id), "Usuário desativado.") : INVALID_USER;
}

export async function reactivateMember(clients: UserAdminClients, id: unknown) {
  return isId(id) ? run(() => reactivateUser(clients, id), "Usuário reativado.") : INVALID_USER;
}
