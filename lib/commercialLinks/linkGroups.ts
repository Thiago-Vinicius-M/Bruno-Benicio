import { agendaNow, currentMonthRange, isIsoDate, periodRange } from "@/lib/agenda/dates";
import type { DateRange } from "@/lib/agenda/types";
import type { CommercialLink } from "./types";

/**
 * Organização do histórico de links no painel: período (pela data de criação, no
 * calendário de Brasília) e as três seções. Tudo sobre os links já carregados: não é
 * regra de acesso (isso é do banco), só de exibição.
 */

export type LinkPeriod = "week" | "month" | "lastMonth" | "30d" | "custom";

export const LINK_PERIOD_OPTIONS: { value: LinkPeriod; label: string }[] = [
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "lastMonth", label: "Mês passado" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "custom", label: "Personalizado" },
];

const DAY_MS = 86_400_000;

/** Intervalo de datas (inclusivo) do período. `custom` usa `from`/`to` informados. */
export function linkPeriodRange(period: LinkPeriod, now: Date = new Date(), custom?: Partial<DateRange>): DateRange | null {
  // Semana de segunda a domingo (a mesma dos relatórios da Agenda).
  if (period === "week") return periodRange("week", now);
  if (period === "month") return currentMonthRange(now);
  if (period === "lastMonth") {
    const firstOfMonth = currentMonthRange(now).from;
    // Meio-dia UTC do dia anterior ao 1º: cai no mês passado em qualquer fuso do Brasil.
    const lastMonthDay = new Date(Date.parse(`${firstOfMonth}T12:00:00Z`) - DAY_MS);
    return currentMonthRange(lastMonthDay);
  }
  if (period === "30d") {
    return { from: agendaNow(new Date(now.getTime() - 29 * DAY_MS)).date, to: agendaNow(now).date };
  }
  const from = custom?.from ?? "";
  const to = custom?.to ?? "";
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) return null;
  return { from, to };
}

/** Data de criação no calendário de Brasília (`YYYY-MM-DD`). */
export const linkCreatedDay = (link: Pick<CommercialLink, "created_at">) => agendaNow(new Date(link.created_at)).date;

export type LinkGroups = {
  /** Dentro da validade (inclusive os sem WhatsApp por canal desativado, que voltam se o canal for reativado). */
  active: CommercialLink[];
  expired: CommercialLink[];
  /** Desativados antes de expirar. */
  revoked: CommercialLink[];
};

/** Texto para busca: minúsculo, sem acentos e com espaços normalizados ("João  " → "joao"). */
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** O nome do evento (identificação do link) contém o termo? Termo vazio = todos. */
export function matchesLinkSearch(link: Pick<CommercialLink, "label">, term: string): boolean {
  const wanted = normalizeSearch(term);
  return !wanted || normalizeSearch(link.label ?? "").includes(wanted);
}

/**
 * Links separados nas três seções (cada uma mantém a ordem recebida). `range` filtra as três
 * pela data de criação (null = todos os períodos); `search`, pelo nome do evento.
 */
export function groupLinks(links: CommercialLink[], range: DateRange | null, search = ""): LinkGroups {
  const groups: LinkGroups = { active: [], expired: [], revoked: [] };
  for (const link of links) {
    if (!matchesLinkSearch(link, search)) continue;
    if (range) {
      const day = linkCreatedDay(link);
      if (day < range.from || day > range.to) continue;
    }
    if (link.status === "expired") groups.expired.push(link);
    else if (link.status === "revoked") groups.revoked.push(link);
    else groups.active.push(link);
  }
  return groups;
}
