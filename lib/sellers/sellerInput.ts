import { validationError } from "@/lib/agenda/errors";
import { normalizeWhatsApp } from "@/lib/whatsapp";
import type { SellerInput } from "./types";

/** Validação do vendedor (formulário e servidor); o banco repete as regras (checks). */

export const SELLER_NAME_MAX = 80;

export type SellerRow = { name: string; whatsapp: string };

export function toSellerRow(input: SellerInput): SellerRow {
  const name = (input.name ?? "").replace(/\s+/g, " ").trim();
  if (!name) throw validationError("Informe o nome do vendedor.");
  if (name.length > SELLER_NAME_MAX) throw validationError(`Nome muito longo (máx. ${SELLER_NAME_MAX} caracteres).`);
  const whatsapp = normalizeWhatsApp(input.whatsapp);
  if (!whatsapp.ok) throw validationError(whatsapp.message);
  return { name, whatsapp: whatsapp.digits };
}
