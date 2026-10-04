import type { Session, User } from "@supabase/supabase-js";
import type { AgendaClient } from "@/lib/supabase/client";
import { AgendaError, toAgendaError, validationError } from "./errors";

/**
 * Autenticação 100% Supabase Auth: senhas, sessões, recuperação e troca de senha
 * ficam no Auth. Nenhuma senha passa pelas tabelas da aplicação.
 */

export async function signIn(client: AgendaClient, email: string, password: string): Promise<Session> {
  if (!email.trim() || !password) throw validationError("Informe e-mail e senha.");
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw toAgendaError(error);
  if (!data.session) throw new AgendaError("UNKNOWN", "Não foi possível iniciar a sessão.");
  return data.session;
}

/** `global` revoga a sessão no Auth; `local` só apaga os cookies/armazenamento deste cliente. */
export async function signOut(client: AgendaClient, scope: "global" | "local" = "global"): Promise<void> {
  const { error } = await client.auth.signOut(scope === "global" ? undefined : { scope });
  if (error) throw toAgendaError(error);
}

/** Usuário da sessão validado no servidor do Auth; `null` se não houver sessão válida. */
export async function getSessionUser(client: AgendaClient): Promise<User | null> {
  const { data, error } = await client.auth.getUser();
  if (error) {
    const agendaError = toAgendaError(error);
    if (agendaError.code === "UNAUTHENTICATED") return null;
    throw agendaError;
  }
  return data.user;
}

/** Envia o e-mail de recuperação. `redirectTo` deve estar na allow list do Supabase. */
export async function requestPasswordReset(client: AgendaClient, email: string, redirectTo: string): Promise<void> {
  if (!email.trim()) throw validationError("Informe o e-mail.");
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw toAgendaError(error);
}

/** Define nova senha para o usuário logado (também usado ao aceitar convite/recuperação). */
export async function updatePassword(client: AgendaClient, newPassword: string): Promise<void> {
  if (newPassword.length < 8) throw validationError("A senha deve ter pelo menos 8 caracteres.");
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw toAgendaError(error);
}
