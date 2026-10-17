import { validationError } from "@/lib/agenda/errors";
import { isUuid } from "@/lib/painel/actionResult";
import { normalizeWhatsApp } from "@/lib/whatsapp";
import type { ChannelInput, ChannelUpdate } from "./types";

/**
 * Canais de WhatsApp: validação do cadastro (formulário e servidor). O banco repete as
 * regras (formato do número, um número por usuário, dono ativo ADMIN/SELLER) e é a
 * autoridade final. Número e dono não mudam depois de cadastrados.
 */

export const CHANNEL_LABEL_MAX = 60;

/** Espaços repetidos viram um; obrigatório. */
export function normalizeChannelLabel(raw: unknown): string {
  const label = (typeof raw === "string" ? raw : "").replace(/\s+/g, " ").trim();
  if (!label) throw validationError("Informe uma identificação para o WhatsApp (ex.: Comercial).");
  if (label.length > CHANNEL_LABEL_MAX) throw validationError(`Identificação muito longa (máx. ${CHANNEL_LABEL_MAX} caracteres).`);
  return label;
}

export type ChannelRow = { owner_id: string; whatsapp: string; label: string; is_primary: boolean };

/** Entrada do navegador → linha validada. Auditoria, situação e redirecionamento ficam de fora. */
export function parseChannelInput(raw: unknown): ChannelRow {
  const source = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof ChannelInput, unknown>>;
  if (!isUuid(source.ownerId)) throw validationError("Escolha o usuário dono deste WhatsApp.");
  const whatsapp = normalizeWhatsApp(typeof source.whatsapp === "string" ? source.whatsapp : "");
  if (!whatsapp.ok) throw validationError(whatsapp.message);
  return {
    owner_id: source.ownerId,
    whatsapp: whatsapp.digits,
    label: normalizeChannelLabel(source.label),
    is_primary: source.isPrimary === true,
  };
}

export function parseChannelUpdate(raw: unknown): { label: string; is_primary: boolean } {
  const source = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof ChannelUpdate, unknown>>;
  return { label: normalizeChannelLabel(source.label), is_primary: source.isPrimary === true };
}
