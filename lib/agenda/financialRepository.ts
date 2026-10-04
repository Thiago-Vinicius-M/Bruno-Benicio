import type { AgendaClient } from "@/lib/supabase/client";
import { Constants, type TablesInsert } from "@/lib/supabase/database.types";
import { isIsoDate } from "./dates";
import { AgendaError, toAgendaError, unwrap, validationError } from "./errors";
import type {
  DateRange,
  FinancialEntryInput,
  FinancialReportRow,
  FinancialSummary,
  ReportGrouping,
  ShowFinancialEntry,
} from "./types";

/**
 * Financeiro — exclusivo de ADMIN. A restrição real está no RLS: para um EDITOR,
 * leituras voltam vazias e escritas/relatórios falham com FORBIDDEN.
 *
 * Convenção de valores: `amount` é sempre >= 0; o tipo define o sinal
 * (CACHE e OTHER_REVENUE somam, EXPENSE subtrai).
 */

const ENTRY_COLUMNS = "id, show_id, type, description, amount, created_by, updated_by, created_at, updated_at";
const MAX_AMOUNT = 9_999_999_999.99; // numeric(12,2)

export async function listFinancialEntries(client: AgendaClient, showId: string): Promise<ShowFinancialEntry[]> {
  const { data, error } = await client
    .from("show_financial_entries")
    .select(ENTRY_COLUMNS)
    .eq("show_id", showId)
    .order("created_at");
  if (error) throw toAgendaError(error);
  return data;
}

export async function createFinancialEntry(client: AgendaClient, input: FinancialEntryInput): Promise<ShowFinancialEntry> {
  // toEntryRow sem `partial` garante type e amount.
  const row = { show_id: input.showId, ...toEntryRow(input) } as TablesInsert<"show_financial_entries">;
  return unwrap(await client.from("show_financial_entries").insert(row).select(ENTRY_COLUMNS).single());
}

export async function updateFinancialEntry(
  client: AgendaClient,
  id: string,
  input: Partial<Omit<FinancialEntryInput, "showId">>,
): Promise<ShowFinancialEntry> {
  const changes = toEntryRow(input, { partial: true });
  if (Object.keys(changes).length === 0) throw validationError("Nenhuma alteração informada.");
  return unwrap(
    await client.from("show_financial_entries").update(changes).eq("id", id).select(ENTRY_COLUMNS).single(),
    "Lançamento não encontrado.",
  );
}

export async function deleteFinancialEntry(client: AgendaClient, id: string): Promise<void> {
  const { data, error } = await client.from("show_financial_entries").delete().eq("id", id).select("id");
  if (error) throw toAgendaError(error);
  // Sob RLS, "sem permissão" e "inexistente" aparecem igual: nenhuma linha afetada.
  if (data.length === 0) throw new AgendaError("NOT_FOUND", "Lançamento não encontrado.");
}

/** Linhas agregadas por período (semana ISO, mês, ano...), calculadas no banco. */
export async function getFinancialReport(
  client: AgendaClient,
  range: DateRange,
  groupBy: ReportGrouping = "month",
): Promise<FinancialReportRow[]> {
  if (!isIsoDate(range.from) || !isIsoDate(range.to) || range.to < range.from) {
    throw validationError("Período do relatório inválido.");
  }
  const { data, error } = await client.rpc("get_financial_report", {
    p_from: range.from,
    p_to: range.to,
    p_group_by: groupBy,
  });
  if (error) throw toAgendaError(error);
  return data;
}

/** Totais do período inteiro a partir das linhas do relatório (em centavos, sem erro de float). */
export function summarizeReport(rows: FinancialReportRow[]): FinancialSummary {
  const cents = (value: number) => Math.round(Number(value) * 100);
  const sum = (pick: (row: FinancialReportRow) => number) => rows.reduce((total, row) => total + cents(pick(row)), 0) / 100;
  return {
    showCount: rows.reduce((total, row) => total + Number(row.show_count), 0),
    entryCount: rows.reduce((total, row) => total + Number(row.entry_count), 0),
    cacheTotal: sum((r) => r.cache_total),
    otherRevenueTotal: sum((r) => r.other_revenue_total),
    expenseTotal: sum((r) => r.expense_total),
    netTotal: sum((r) => r.net_total),
  };
}

function toEntryRow(input: Partial<Omit<FinancialEntryInput, "showId">>, { partial = false } = {}) {
  const row: Partial<Pick<ShowFinancialEntry, "type" | "description" | "amount">> = {};

  if (input.type !== undefined || !partial) {
    if (!input.type || !Constants.public.Enums.financial_entry_type.includes(input.type)) {
      throw validationError("Tipo de lançamento inválido.");
    }
    row.type = input.type;
  }
  if (input.amount !== undefined || !partial) {
    const amount = input.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
      throw validationError("Valor inválido. Informe um valor maior ou igual a zero (despesas também são positivas).");
    }
    if (Math.round(amount * 100) / 100 !== amount) throw validationError("Use no máximo duas casas decimais.");
    row.amount = amount;
  }
  if (input.description !== undefined) {
    const description = input.description?.trim() || null;
    if (description && description.length > 200) throw validationError("Descrição muito longa (máx. 200 caracteres).");
    row.description = description;
  }
  return row;
}
