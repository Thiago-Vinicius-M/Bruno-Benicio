/**
 * Data e horário opcionais do evento, informados pelo contratante na versão comercial de
 * NOSSO SHOW. São texto do jeito que os campos nativos entregam ("2026-12-20", "21:00") e
 * são formatados por manipulação de texto: nada de Date, então não há fuso nem
 * deslocamento de dia. Não existe regra comercial de antecedência mínima — qualquer data
 * válida do calendário é aceita.
 */

export type ScheduleField = { ok: true; value: string | null } | { ok: false; message: string };

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

const daysInMonth = (year: number, month: number) =>
  [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    month - 1
  ];

/** "" → sem data; "2026-12-20" → a mesma data; outra coisa → mensagem. */
export function parseEventDate(raw: unknown): ScheduleField {
  const text = typeof raw === "string" ? raw.trim() : raw == null ? "" : null;
  if (text === null) return { ok: false, message: "Data do evento inválida." };
  if (!text) return { ok: true, value: null };

  const match = text.match(DATE);
  if (match) {
    const [year, month, day] = match.slice(1).map(Number);
    if (year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)) {
      return { ok: true, value: text };
    }
  }
  return { ok: false, message: "Data do evento inválida. Use o formato dia/mês/ano." };
}

/** "" → sem horário; "21:00" (ou "21:00:00") → "21:00"; outra coisa → mensagem. */
export function parseEventTime(raw: unknown): ScheduleField {
  const text = typeof raw === "string" ? raw.trim() : raw == null ? "" : null;
  if (text === null) return { ok: false, message: "Horário do evento inválido." };
  if (!text) return { ok: true, value: null };

  const match = text.match(TIME);
  return match
    ? { ok: true, value: `${match[1]}:${match[2]}` }
    : { ok: false, message: "Horário do evento inválido. Use horas e minutos (ex.: 21:00)." };
}

/** "2026-12-20" → "20/12/2026". */
export function formatEventDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
