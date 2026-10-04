import { requestPasswordReset, signIn, signOut, updatePassword } from "@/lib/agenda/authService";
import { toAgendaError } from "@/lib/agenda/errors";
import type { AgendaClient } from "@/lib/supabase/client";
import { DENIED_MESSAGES, resolvePanelAccess } from "./access";

/**
 * Regras dos formulários de autenticação do painel, independentes do Next (as Server
 * Actions em app/painel/actions.ts só criam o cliente e redirecionam). Tudo passa pelo
 * Supabase Auth via lib/agenda/authService: a aplicação nunca guarda senha nem cria
 * cookies próprios.
 */

/** Estado devolvido aos formulários (`useActionState`). As mensagens são seguras para exibir. */
export type FormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export const IDLE: FormState = { status: "idle" };

const fail = (message: string): FormState => ({ status: "error", message });
const messageOf = (error: unknown) => toAgendaError(error).message;

/** Lê um campo de texto do FormData (arquivos e ausência viram string vazia). */
export const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

/**
 * Login com e-mail e senha. Sessão válida não basta: sem perfil ativo, a sessão recém
 * criada é encerrada na hora e o acesso é negado.
 */
export async function loginWithPassword(client: AgendaClient, email: string, password: string): Promise<FormState> {
  try {
    await signIn(client, email, password);
  } catch (error) {
    return fail(messageOf(error));
  }

  try {
    const access = await resolvePanelAccess(client);
    if (access.status === "granted") return { status: "success", message: "Login realizado." };
    await signOutQuietly(client);
    return fail(access.status === "denied" ? DENIED_MESSAGES[access.reason] : "Não foi possível iniciar a sessão.");
  } catch (error) {
    await signOutQuietly(client);
    return fail(messageOf(error));
  }
}

/** Encerra a sessão no Supabase. Falha (ex.: sessão já expirada) não impede sair do painel. */
export async function signOutQuietly(client: AgendaClient): Promise<void> {
  try {
    await signOut(client);
  } catch {
    // A revogação no Auth pode falhar (ex.: usuário desativado/banido). Os cookies desta
    // sessão precisam sair mesmo assim, senão o usuário fica preso fora do login.
    await signOut(client, "local").catch(() => {});
  }
}

const recoverySent: FormState = {
  status: "success",
  message: "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Confira também o spam.",
};

/**
 * Pede o e-mail de recuperação. A resposta é a mesma exista ou não a conta, para não
 * revelar quais e-mails estão cadastrados.
 */
export async function sendRecoveryEmail(client: AgendaClient, email: string, redirectTo: string): Promise<FormState> {
  try {
    await requestPasswordReset(client, email, redirectTo);
  } catch (error) {
    const agendaError = toAgendaError(error);
    // Validação e excesso de tentativas são informados; o resto não pode revelar nada.
    if (agendaError.code !== "VALIDATION" && agendaError.code !== "RATE_LIMITED") return recoverySent;
    return fail(agendaError.message);
  }
  return recoverySent;
}

/** Troca a senha do usuário logado (também usada ao voltar do link de recuperação). */
export async function changePassword(client: AgendaClient, password: string, confirmation: string): Promise<FormState> {
  if (!password || !confirmation) return fail("Preencha os dois campos.");
  if (password !== confirmation) return fail("As senhas não conferem.");
  try {
    await updatePassword(client, password);
  } catch (error) {
    return fail(messageOf(error));
  }
  return { status: "success", message: "Senha alterada com sucesso." };
}
