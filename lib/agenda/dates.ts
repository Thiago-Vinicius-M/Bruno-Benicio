import type { DateRange, ReportGrouping } from "./types";

/**
 * Datas da Agenda são de calendário local da banda. "Hoje" é calculado neste fuso,
 * nunca no fuso do servidor (que em produção costuma ser UTC: às 22h de 30/09 em
 * São Paulo já é 01/10 em UTC).
 */
export const AGENDA_TIME_ZONE = "America/Sao_Paulo";

type YMD = { year: number; month: number; day: number };

function todayIn(timeZone: string, now: Date): YMD {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

// Aritmética de calendário em UTC puro (sem horário de verão/fuso envolvidos).
const utc = ({ year, month, day }: YMD) => new Date(Date.UTC(year, month - 1, day));
const toIso = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Data e hora de agora no calendário da banda (`YYYY-MM-DD` e `HH:MM`), para comparar
 * com show_date/show_time — que também são "de parede", sem fuso.
 */
export function agendaNow(now: Date = new Date(), timeZone: string = AGENDA_TIME_ZONE): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Primeiro e último dia do mês corrente. Ex.: 29/09/2026 → 2026-09-01 a 2026-09-30. */
export function currentMonthRange(now: Date = new Date(), timeZone: string = AGENDA_TIME_ZONE): DateRange {
  return periodRange("month", now, timeZone);
}

/** Intervalo do período que contém `reference`. Semana = ISO (segunda a domingo), igual ao SQL. */
export function periodRange(
  period: Exclude<ReportGrouping, "day">,
  reference: Date = new Date(),
  timeZone: string = AGENDA_TIME_ZONE,
): DateRange {
  const today = todayIn(timeZone, reference);

  if (period === "year") {
    return { from: `${today.year}-01-01`, to: `${today.year}-12-31` };
  }
  if (period === "month") {
    const last = new Date(Date.UTC(today.year, today.month, 0)); // dia 0 do mês seguinte
    return { from: toIso(utc({ ...today, day: 1 })), to: toIso(last) };
  }
  const date = utc(today);
  const offsetFromMonday = (date.getUTCDay() + 6) % 7;
  const monday = new Date(date.getTime() - offsetFromMonday * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  return { from: toIso(monday), to: toIso(sunday) };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Valida `YYYY-MM-DD` como data real (rejeita 2026-02-30). */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return toIso(utc({ year, month, day })) === value;
}

/** Valida `HH:MM` ou `HH:MM:SS` (24h). */
export const isTimeOfDay = (value: string) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
