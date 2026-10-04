import type { AgendaClient } from "@/lib/supabase/client";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { agendaNow, isIsoDate, isTimeOfDay } from "./dates";
import { toAgendaError, unwrap, validationError } from "./errors";
import { normalizeInstagramHandle } from "./instagram";
import type { DateRange, Show, ShowInput, ShowStatusFilter, ShowTimeFilter } from "./types";

/**
 * Shows do painel (ADMIN e EDITOR). Autoria e timestamps são preenchidos pelo
 * banco a partir da sessão; este módulo nunca envia created_by/updated_by/deleted_by.
 * Recebe o cliente por parâmetro: funciona com o cliente do navegador ou do servidor.
 */

const SHOW_COLUMNS =
  "id, show_date, show_time, venue_name, venue_instagram, created_by, updated_by, deleted_by, created_at, updated_at, deleted_at";

const NOT_FOUND = "Show não encontrado.";

export type ListShowsOptions = {
  range?: DateRange;
  status?: ShowStatusFilter;
  /** Próximos (data/hora ainda não chegou) ou passados, pelo relógio de São Paulo. */
  when?: ShowTimeFilter;
  /** Referência de "agora" para `when` (testes). */
  now?: Date;
};

export async function listShows(
  client: AgendaClient,
  { range, status = "active", when, now }: ListShowsOptions = {},
): Promise<Show[]> {
  let query = client.from("shows").select(SHOW_COLUMNS);

  if (status === "active") query = query.is("deleted_at", null);
  if (status === "deleted") query = query.not("deleted_at", "is", null);
  if (range) query = query.gte("show_date", range.from).lte("show_date", range.to);
  if (when) {
    // Datas/horas de parede comparadas como texto do Postgres: sem conversão de fuso.
    const { date, time } = agendaNow(now);
    query =
      when === "upcoming"
        ? query.or(`show_date.gt.${date},and(show_date.eq.${date},show_time.gte.${time})`)
        : query.or(`show_date.lt.${date},and(show_date.eq.${date},show_time.lt.${time})`);
  }

  if (status === "deleted") {
    query = query.order("deleted_at", { ascending: false });
  } else {
    // Mais próximos de hoje primeiro: futuros em ordem crescente, passados do mais recente ao mais antigo.
    const ascending = when !== "past";
    query = query.order("show_date", { ascending }).order("show_time", { ascending }).order("venue_name");
  }

  const { data, error } = await query;
  if (error) throw toAgendaError(error);
  return data;
}

/** Busca um show, inclusive excluído (o painel mostra o status). */
export async function getShow(client: AgendaClient, id: string): Promise<Show> {
  return unwrap(await client.from("shows").select(SHOW_COLUMNS).eq("id", id).single(), NOT_FOUND);
}

export async function createShow(client: AgendaClient, input: ShowInput): Promise<Show> {
  // toShowRow sem `partial` garante data, horário e local.
  const row = toShowRow(input) as TablesInsert<"shows">;
  return unwrap(await client.from("shows").insert(row).select(SHOW_COLUMNS).single());
}

export async function updateShow(client: AgendaClient, id: string, input: Partial<ShowInput>): Promise<Show> {
  const changes = toShowRow(input, { partial: true });
  if (Object.keys(changes).length === 0) throw validationError("Nenhuma alteração informada.");
  return unwrap(
    await client.from("shows").update(changes).eq("id", id).is("deleted_at", null).select(SHOW_COLUMNS).single(),
    "Show não encontrado ou já excluído.",
  );
}

/** Exclusão lógica. O banco grava deleted_at = now() e deleted_by = usuário da sessão. */
export async function softDeleteShow(client: AgendaClient, id: string): Promise<Show> {
  return unwrap(
    await client
      .from("shows")
      // O valor é substituído pelo trigger; só sinaliza a transição para "excluído".
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null)
      .select(SHOW_COLUMNS)
      .single(),
    "Show não encontrado ou já excluído.",
  );
}

/** Desfaz a exclusão lógica (para a futura lixeira do painel). */
export async function restoreShow(client: AgendaClient, id: string): Promise<Show> {
  return unwrap(
    await client
      .from("shows")
      .update({ deleted_at: null })
      .eq("id", id)
      .not("deleted_at", "is", null)
      .select(SHOW_COLUMNS)
      .single(),
    "Show não encontrado ou não está excluído.",
  );
}

/** Valida e normaliza a entrada do formulário para colunas do banco. */
export function toShowRow(input: Partial<ShowInput>, { partial = false } = {}) {
  const row: { show_date?: string; show_time?: string; venue_name?: string; venue_instagram?: string | null } = {};

  if (input.showDate !== undefined || !partial) {
    if (!input.showDate || !isIsoDate(input.showDate)) throw validationError("Data do show inválida.");
    row.show_date = input.showDate;
  }
  if (input.showTime !== undefined || !partial) {
    if (!input.showTime || !isTimeOfDay(input.showTime)) throw validationError("Horário do show inválido.");
    row.show_time = input.showTime;
  }
  if (input.venueName !== undefined || !partial) {
    const venueName = input.venueName?.trim() ?? "";
    if (!venueName) throw validationError("Informe o nome do local.");
    if (venueName.length > 160) throw validationError("Nome do local muito longo (máx. 160 caracteres).");
    row.venue_name = venueName;
  }
  if (input.venueInstagram !== undefined || !partial) {
    row.venue_instagram = normalizeInstagramHandle(input.venueInstagram);
  }
  return row;
}
