import { AGENDA_TIME_ZONE } from "@/lib/agenda/dates";

/**
 * Apresentação de datas da Agenda. `show_date` é data de calendário: é lida como texto
 * (`YYYY-MM-DD`) e nunca passa por `new Date("2026-10-05")`, que a interpretaria como
 * meia-noite UTC e, no Brasil, viraria 04/10.
 */

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const split = (isoDate: string) => isoDate.split("-").map(Number) as [number, number, number];

export function showDateParts(isoDate: string) {
  const [year, month, day] = split(isoDate);
  // Dia da semana por aritmética de calendário em UTC (sem fuso envolvido).
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return { day: String(day).padStart(2, "0"), month: MONTHS[month - 1], year, weekday };
}

/** `2026-10-05` → `05/10/2026`. */
export const formatShowDate = (isoDate: string) => {
  const [year, month, day] = split(isoDate);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
};

/** `21:30:00` → `21:30` (o banco devolve segundos). */
export const formatShowTime = (time: string) => time.slice(0, 5);

/** Chave do mês (`2026-10`) e rótulo (`Outubro 2026`) para agrupar a lista. */
export const monthKey = (isoDate: string) => isoDate.slice(0, 7);
export const monthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
};

/** Instantes de auditoria (timestamptz) no fuso da banda: `29/09/2026 14:03`. */
const timestampFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: AGENDA_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
export const formatTimestamp = (value: string) => timestampFormat.format(new Date(value)).replace(",", "");

/** Um show já aconteceu? Compara data/hora de parede com o "agora" de São Paulo. */
export const isPastShow = (show: { show_date: string; show_time: string }, now: { date: string; time: string }) =>
  show.show_date < now.date || (show.show_date === now.date && formatShowTime(show.show_time) < now.time);
