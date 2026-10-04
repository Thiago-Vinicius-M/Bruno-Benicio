import { isAuthError, isAuthSessionMissingError } from "@supabase/supabase-js";

/**
 * Erro único da camada de dados da Agenda. A UI decide como exibir (o projeto ainda
 * não tem sistema de notificações); `message` já é segura para mostrar ao usuário e
 * `cause` guarda o erro original para log.
 */
export type AgendaErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UNKNOWN";

export class AgendaError extends Error {
  readonly code: AgendaErrorCode;

  constructor(code: AgendaErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AgendaError";
    this.code = code;
  }
}

export const isAgendaError = (error: unknown): error is AgendaError => error instanceof AgendaError;

const DEFAULT_MESSAGES: Record<AgendaErrorCode, string> = {
  UNAUTHENTICATED: "Sua sessão expirou. Entre novamente.",
  INVALID_CREDENTIALS: "E-mail ou senha incorretos.",
  FORBIDDEN: "Você não tem permissão para esta operação.",
  NOT_FOUND: "Registro não encontrado.",
  VALIDATION: "Dados inválidos.",
  CONFLICT: "A operação conflita com o estado atual dos dados.",
  RATE_LIMITED: "Muitas tentativas. Aguarde alguns instantes e tente novamente.",
  UNKNOWN: "Erro inesperado. Tente novamente.",
};

/** Códigos de erro do Supabase Auth (`AuthError.code`) mais relevantes. */
const AUTH_ERRORS: Record<string, { code: AgendaErrorCode; message?: string }> = {
  invalid_credentials: { code: "INVALID_CREDENTIALS" },
  over_request_rate_limit: { code: "RATE_LIMITED" },
  over_email_send_rate_limit: { code: "RATE_LIMITED" },
  weak_password: { code: "VALIDATION", message: "Senha fraca. Use uma senha mais longa e variada." },
  same_password: { code: "VALIDATION", message: "A nova senha deve ser diferente da atual." },
  validation_failed: { code: "VALIDATION" },
  email_exists: { code: "CONFLICT", message: "Já existe um usuário com este e-mail." },
  user_already_exists: { code: "CONFLICT", message: "Já existe um usuário com este e-mail." },
  user_banned: { code: "FORBIDDEN", message: "Este usuário está desativado." },
  email_not_confirmed: { code: "FORBIDDEN", message: "E-mail ainda não confirmado. Use o link enviado para o seu e-mail." },
  reauthentication_needed: { code: "UNAUTHENTICATED", message: "Por segurança, saia e entre novamente antes de trocar a senha." },
  session_not_found: { code: "UNAUTHENTICATED" },
  refresh_token_not_found: { code: "UNAUTHENTICATED" },
};

/** Códigos SQLSTATE próprios definidos na migration (mensagem do banco já em pt-BR). */
const APP_SQLSTATES = new Set(["AG001", "AG002", "AG003", "AG004"]);

type PostgrestLikeError = { code?: string; message?: string };

function codeForPostgres(sqlstate: string | undefined): AgendaErrorCode {
  if (!sqlstate) return "UNKNOWN";
  if (APP_SQLSTATES.has(sqlstate)) return "CONFLICT";
  switch (sqlstate) {
    case "42501": // insufficient_privilege / violação de RLS
      return "FORBIDDEN";
    case "PGRST116": // .single() sem linha — inexistente ou oculto pelo RLS
      return "NOT_FOUND";
    case "PGRST301": // JWT expirado/inválido
    case "PGRST302":
      return "UNAUTHENTICATED";
    case "23001": // restrict_violation
    case "23503": // foreign_key_violation
    case "23505": // unique_violation
      return "CONFLICT";
    case "22023": // invalid_parameter_value (validações das funções SQL)
      return "VALIDATION";
  }
  // 22xxx (dados inválidos) e 23xxx restantes (not null, check).
  if (sqlstate.startsWith("22") || sqlstate.startsWith("23")) return "VALIDATION";
  return "UNKNOWN";
}

/** Converte qualquer erro do Supabase (PostgREST ou Auth) em AgendaError. */
export function toAgendaError(error: unknown, fallbackMessage?: string): AgendaError {
  if (isAgendaError(error)) return error;

  if (isAuthSessionMissingError(error)) {
    return new AgendaError("UNAUTHENTICATED", DEFAULT_MESSAGES.UNAUTHENTICATED, { cause: error });
  }
  if (isAuthError(error)) {
    const known = error.code ? AUTH_ERRORS[error.code] : undefined;
    const code: AgendaErrorCode =
      known?.code ?? (error.status === 429 ? "RATE_LIMITED" : error.status === 401 ? "UNAUTHENTICATED" : "UNKNOWN");
    return new AgendaError(code, known?.message ?? DEFAULT_MESSAGES[code], { cause: error });
  }

  const pg = error as PostgrestLikeError | null;
  if (pg && typeof pg === "object" && typeof pg.message === "string") {
    const code = codeForPostgres(pg.code);
    // Mensagens das regras próprias e validações SQL já são pt-BR e voltadas ao usuário.
    const useDbMessage = (pg.code && APP_SQLSTATES.has(pg.code)) || pg.code === "22023";
    const message = useDbMessage ? pg.message : (fallbackMessage ?? DEFAULT_MESSAGES[code]);
    return new AgendaError(code, message, { cause: error });
  }

  return new AgendaError("UNKNOWN", fallbackMessage ?? DEFAULT_MESSAGES.UNKNOWN, { cause: error });
}

/** Desembrulha `{ data, error }` do Supabase: lança AgendaError ou devolve `data`. */
export function unwrap<T>(result: { data: T; error: unknown }, notFoundMessage?: string): NonNullable<T> {
  if (result.error) {
    const error = toAgendaError(result.error);
    if (error.code === "NOT_FOUND" && notFoundMessage) {
      throw new AgendaError("NOT_FOUND", notFoundMessage, { cause: result.error });
    }
    throw error;
  }
  if (result.data === null || result.data === undefined) {
    throw new AgendaError("NOT_FOUND", notFoundMessage ?? DEFAULT_MESSAGES.NOT_FOUND);
  }
  return result.data;
}

export const validationError = (message: string) => new AgendaError("VALIDATION", message);
