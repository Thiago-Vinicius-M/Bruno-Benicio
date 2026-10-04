import { toAgendaError, type AgendaError } from "@/lib/agenda/errors";
import {
  createShow,
  listShows,
  restoreShow,
  softDeleteShow,
  updateShow,
  type ListShowsOptions,
} from "@/lib/agenda/showsRepository";
import type { ShowInput } from "@/lib/agenda/types";
import type { AgendaClient } from "@/lib/supabase/client";

/**
 * Agenda administrativa: filtros da listagem e regras das operações de show. Tudo
 * passa por lib/agenda/showsRepository (nenhuma chamada Supabase direta aqui) e a
 * autoria (created_by/updated_by/deleted_by) é sempre definida pelo banco.
 * ADMIN e EDITOR têm as mesmas permissões sobre shows: não há checagem de papel.
 */

export const AGENDA_FILTERS = {
  todos: { label: "Todos", options: { status: "active" } },
  proximos: { label: "Próximos", options: { status: "active", when: "upcoming" } },
  passados: { label: "Passados", options: { status: "active", when: "past" } },
  excluidos: { label: "Excluídos", options: { status: "deleted" } },
} satisfies Record<string, { label: string; options: ListShowsOptions }>;

export type AgendaFilter = keyof typeof AGENDA_FILTERS;

export const DEFAULT_AGENDA_FILTER: AgendaFilter = "todos";

export const parseAgendaFilter = (value: unknown): AgendaFilter =>
  typeof value === "string" && Object.hasOwn(AGENDA_FILTERS, value) ? (value as AgendaFilter) : DEFAULT_AGENDA_FILTER;

export function listAgenda(client: AgendaClient, filter: AgendaFilter, now?: Date) {
  return listShows(client, { ...AGENDA_FILTERS[filter].options, now });
}

/** Resultado das operações, com mensagem pronta para o usuário (pt-BR, sem detalhes técnicos). */
export type ShowActionResult = { status: "success"; message: string } | { status: "error"; message: string };

/**
 * Entrada vinda do navegador: só os quatro campos do formulário, como texto.
 * Qualquer outra propriedade (created_by, deleted_by, role...) é descartada.
 */
export function parseShowInput(raw: unknown): ShowInput {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (key: string) => (typeof source[key] === "string" ? (source[key] as string) : "");
  return {
    showDate: text("showDate"),
    showTime: text("showTime"),
    venueName: text("venueName"),
    venueInstagram: text("venueInstagram"),
  };
}

const isId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function failure(error: unknown, fallback: string): ShowActionResult {
  const agendaError: AgendaError = toAgendaError(error);
  if (agendaError.code === "UNKNOWN") {
    // Detalhe técnico só no log do servidor.
    console.error("[agenda]", agendaError.cause ?? agendaError);
    return { status: "error", message: fallback };
  }
  return { status: "error", message: agendaError.message };
}

async function run(operation: () => Promise<unknown>, success: string, fallback: string): Promise<ShowActionResult> {
  try {
    await operation();
    return { status: "success", message: success };
  } catch (error) {
    return failure(error, fallback);
  }
}

const invalidShow: ShowActionResult = { status: "error", message: "Show inválido." };

export const createShowFromInput = (client: AgendaClient, raw: unknown) =>
  run(
    () => createShow(client, parseShowInput(raw)),
    "Show criado com sucesso.",
    "Não foi possível salvar o show. Tente novamente.",
  );

export const updateShowFromInput = async (client: AgendaClient, id: unknown, raw: unknown) =>
  isId(id)
    ? run(
        () => updateShow(client, id, parseShowInput(raw)),
        "Show atualizado com sucesso.",
        "Não foi possível salvar o show. Tente novamente.",
      )
    : invalidShow;

export const deleteShowById = async (client: AgendaClient, id: unknown) =>
  isId(id)
    ? run(() => softDeleteShow(client, id), "Show excluído com sucesso.", "Não foi possível excluir o show. Tente novamente.")
    : invalidShow;

export const restoreShowById = async (client: AgendaClient, id: unknown) =>
  isId(id)
    ? run(() => restoreShow(client, id), "Show restaurado com sucesso.", "Não foi possível restaurar o show. Tente novamente.")
    : invalidShow;
