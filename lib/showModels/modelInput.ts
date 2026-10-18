import { validationError } from "@/lib/agenda/errors";
import { parsePrice } from "./price";
import type { ShowModelInput } from "./types";

/**
 * Validação e normalização dos campos do modelo de show para as colunas do banco. A
 * mesma no formulário e no servidor; o banco continua sendo a autoridade final (checks).
 */

export const NAME_MAX = 80;
export const DURATION_MAX = 60;
export const DESCRIPTION_MAX = 280;

export type ShowModelRow = {
  name: string;
  duration: string;
  description: string | null;
  price: number;
  corporate_price: number;
};

/** Espaços repetidos viram um (o nome vai na mensagem do WhatsApp). */
const clean = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

export function toShowModelRow(input: ShowModelInput): ShowModelRow {
  const name = clean(input.name);
  if (!name) throw validationError("Informe o nome do modelo.");
  if (name.length > NAME_MAX) throw validationError(`Nome muito longo (máx. ${NAME_MAX} caracteres).`);

  const duration = clean(input.duration);
  if (!duration) throw validationError("Informe a duração do show (ex.: 2h30 de show).");
  if (duration.length > DURATION_MAX) throw validationError(`Duração muito longa (máx. ${DURATION_MAX} caracteres).`);

  const description = input.description?.trim() || null;
  if (description && description.length > DESCRIPTION_MAX) {
    throw validationError(`Descrição muito longa (máx. ${DESCRIPTION_MAX} caracteres).`);
  }

  const price = parsePrice(input.price);
  if (price === null) throw validationError("Informe um valor válido em reais, maior que zero (ex.: 1.500,00).");

  const corporatePrice = parsePrice(input.corporatePrice);
  if (corporatePrice === null) {
    throw validationError("Informe um valor corporativo válido em reais, maior que zero (ex.: 2.000,00).");
  }

  return { name, duration, description, price, corporate_price: corporatePrice };
}
