import type { AgendaClient } from "@/lib/supabase/client";
import { currentMonthRange } from "./dates";
import { toAgendaError } from "./errors";
import type { DateRange, PublicShow } from "./types";

/**
 * Agenda do site público. Usa somente a função `get_public_agenda`, que devolve
 * data, horário, local e Instagram de shows ativos — nunca dados financeiros.
 * Estes mesmos objetos alimentarão a exportação para WhatsApp e o PDF público.
 */
export async function getPublicAgenda(client: AgendaClient, range: DateRange): Promise<PublicShow[]> {
  const { data, error } = await client.rpc("get_public_agenda", { p_from: range.from, p_to: range.to });
  if (error) throw toAgendaError(error, "Não foi possível carregar a agenda.");
  return data;
}

/** Shows do mês corrente (fuso de São Paulo). Em outubro passa a mostrar outubro sozinho. */
export function getCurrentMonthAgenda(client: AgendaClient, now: Date = new Date()): Promise<PublicShow[]> {
  return getPublicAgenda(client, currentMonthRange(now));
}
