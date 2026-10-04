import type { Database, Enums, Tables } from "@/lib/supabase/database.types";

/** Tipos de domínio derivados dos tipos gerados do banco (não duplicar colunas aqui). */

export type Role = Enums<"app_role">;
export type FinancialEntryType = Enums<"financial_entry_type">;

export type Profile = Tables<"profiles">;
export type Show = Tables<"shows">;
export type ShowFinancialEntry = Tables<"show_financial_entries">;

/**
 * Show como o site público o enxerga: sem auditoria e sem nenhum dado financeiro.
 * Usado pela Agenda, pela exportação para WhatsApp e pelo PDF público.
 */
export type PublicShow = Omit<Database["public"]["Functions"]["get_public_agenda"]["Returns"][number], "venue_instagram"> & {
  // O gerador de tipos não conhece a nulidade de colunas de RETURNS TABLE.
  venue_instagram: string | null;
};

export type FinancialReportRow = Database["public"]["Functions"]["get_financial_report"]["Returns"][number];
export type ReportGrouping = "day" | "week" | "month" | "year";

/** Datas `YYYY-MM-DD` (calendário local da banda) — mesmo formato do tipo `date` do Postgres. */
export type DateRange = { from: string; to: string };

/** Filtro de listagem do painel. `deleted` = lixeira; `all` = histórico completo. */
export type ShowStatusFilter = "active" | "deleted" | "all";

/** Recorte temporal da listagem (data + horário no fuso da banda). */
export type ShowTimeFilter = "upcoming" | "past";

export type ShowInput = {
  showDate: string;
  showTime: string;
  venueName: string;
  /** Aceita `casa`, `@casa` ou URL do perfil; é normalizado para o username. */
  venueInstagram?: string | null;
};

export type FinancialEntryInput = {
  showId: string;
  type: FinancialEntryType;
  description?: string | null;
  /** Magnitude, sempre >= 0. Despesas NÃO são negativas: o tipo EXPENSE já subtrai. */
  amount: number;
};

export type FinancialSummary = {
  showCount: number;
  entryCount: number;
  cacheTotal: number;
  otherRevenueTotal: number;
  expenseTotal: number;
  netTotal: number;
};
