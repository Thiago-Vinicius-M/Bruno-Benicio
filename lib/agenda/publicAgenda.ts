import type { AgendaClient } from "@/lib/supabase/client";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { agendaNow, currentMonthRange, restOfMonthRange, type AgendaNow } from "./dates";
import { toAgendaError } from "./errors";
import { getPublicAgendaEnabled } from "./settingsRepository";
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

/**
 * Seção AGENDA da Home: `null` = desabilitada no painel (sem seção e sem link na navegação).
 * `now` é o "agora" (São Paulo) de quando a página foi gerada; o navegador continua tirando
 * os shows que já passaram (components/Agenda) sem esperar a página ser regenerada.
 */
export type PublicAgendaState = { shows: PublicShow[]; now: AgendaNow } | null;

/**
 * Shows do mês atual de hoje em diante, só com a agenda habilitada (nada de meses passados
 * nem do próximo mês). Sem banco (não configurado ou fora do ar) a seção simplesmente não
 * aparece — o resto do site continua no ar.
 */
export async function loadPublicAgenda(now: Date = new Date()): Promise<PublicAgendaState> {
  try {
    const client = createSupabasePublicClient();
    if (!(await getPublicAgendaEnabled(client))) return null;
    return { shows: await getPublicAgenda(client, restOfMonthRange(now)), now: agendaNow(now) };
  } catch (error) {
    console.error("[agenda] falha ao carregar a agenda do site", error);
    return null;
  }
}
