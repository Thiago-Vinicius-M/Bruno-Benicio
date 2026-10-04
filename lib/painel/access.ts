import { getSessionUser } from "@/lib/agenda/authService";
import { isAgendaError } from "@/lib/agenda/errors";
import { getProfileByUserId } from "@/lib/agenda/profilesRepository";
import type { Role } from "@/lib/agenda/types";
import type { AgendaClient } from "@/lib/supabase/client";

/**
 * Quem pode entrar no painel. Ter sessão NÃO basta: é preciso um perfil em `profiles`
 * que não esteja desativado. O papel vem sempre do banco (sessão → auth.uid() →
 * profiles.role), nunca do navegador.
 */

/** Somente o que a interface do painel precisa (DTO): nada de e-mail, tokens ou auditoria. */
export type PanelUser = { id: string; name: string; role: Role };

export type PanelAccess =
  | { status: "anonymous" }
  | { status: "denied"; reason: "no-profile" | "deactivated" }
  | { status: "granted"; user: PanelUser };

export async function resolvePanelAccess(client: AgendaClient): Promise<PanelAccess> {
  let user: Awaited<ReturnType<typeof getSessionUser>>;
  try {
    user = await getSessionUser(client);
  } catch (error) {
    // Desativar bloqueia o login no Auth (ban): uma sessão que já estava aberta passa a
    // receber `user_banned` (FORBIDDEN). É acesso negado, não uma falha do painel.
    if (isAgendaError(error) && error.code === "FORBIDDEN") return { status: "denied", reason: "deactivated" };
    throw error;
  }
  if (!user) return { status: "anonymous" };

  const profile = await getProfileByUserId(client, user.id);
  if (!profile) return { status: "denied", reason: "no-profile" };
  if (profile.deactivated_at) return { status: "denied", reason: "deactivated" };
  return { status: "granted", user: { id: profile.id, name: profile.name, role: profile.role } };
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  EDITOR: "Editor",
};

export const DENIED_MESSAGES: Record<Extract<PanelAccess, { status: "denied" }>["reason"], string> = {
  "no-profile": "Seu usuário não tem acesso ao painel. Fale com um administrador.",
  deactivated: "Este usuário está desativado. Fale com um administrador.",
};
