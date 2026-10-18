import { validationError } from "@/lib/agenda/errors";
import { zonedTimeToInstant } from "@/lib/agenda/dates";
import { isUuid } from "@/lib/painel/actionResult";
import { parsePrice } from "@/lib/showModels/price";
import type { CommercialLinkInput, LinkValidity } from "./types";

/**
 * Links comerciais temporários: regras de validade e validação da criação (formulário e
 * servidor). O banco (create_commercial_link) é a autoridade final: recalcula os prazos
 * predefinidos com now() e recusa expiração passada, igual ao instante atual ou acima de
 * 7 dias. Aqui o relógio do navegador só serve para avisar antes de enviar.
 *
 * Precisão: o link expira quando o instante atual é maior ou igual a expires_at
 * (timestamptz, microssegundos). No prazo personalizado escolhe-se até o minuto, sempre no
 * horário de Brasília (America/Sao_Paulo), convertido para o instante absoluto.
 */

export const LINK_MAX_DAYS = 7;
export const LINK_MAX_MS = LINK_MAX_DAYS * 24 * 3_600_000;
export const LINK_LABEL_MAX = 80;

export const LINK_VALIDITY_OPTIONS: { value: LinkValidity; label: string }[] = [
  { value: "24h", label: "24 horas" },
  { value: "3d", label: "3 dias" },
  { value: "7d", label: "7 dias" },
  { value: "custom", label: "Personalizado" },
];

/** Duração de cada prazo predefinido (o banco usa as mesmas). */
export const LINK_PRESET_MS: Record<Exclude<LinkValidity, "custom">, number> = {
  "24h": 24 * 3_600_000,
  "3d": 72 * 3_600_000,
  "7d": LINK_MAX_MS,
};

const isValidity = (value: unknown): value is LinkValidity =>
  typeof value === "string" && LINK_VALIDITY_OPTIONS.some((option) => option.value === value);

export type ExpiryCheck = { ok: true; expiresAt: Date } | { ok: false; message: string };

/** Prazo personalizado (data e horário de Brasília): futuro e até 7 dias a partir de `now`. */
export function checkCustomExpiry(date: string, time: string, now: Date = new Date()): ExpiryCheck {
  if (!date || !time) return { ok: false, message: "Informe a data e o horário de expiração." };
  const expiresAt = zonedTimeToInstant(date, time);
  if (!expiresAt) return { ok: false, message: "Data ou horário de expiração inválido." };
  if (expiresAt.getTime() <= now.getTime()) {
    return { ok: false, message: "A expiração precisa ser uma data e um horário futuros." };
  }
  if (expiresAt.getTime() - now.getTime() > LINK_MAX_MS) {
    return { ok: false, message: `A validade máxima de um link é de ${LINK_MAX_DAYS} dias.` };
  }
  return { ok: true, expiresAt };
}

/** Espaços repetidos viram um; vazio → null. */
export function normalizeLinkLabel(raw: unknown): string | null {
  const label = (typeof raw === "string" ? raw : "").replace(/\s+/g, " ").trim();
  if (label.length > LINK_LABEL_MAX) throw validationError(`Identificação muito longa (máx. ${LINK_LABEL_MAX} caracteres).`);
  return label || null;
}

/**
 * Entrada do navegador → criação validada. Só canal de WhatsApp, identificação, validade e
 * os modelos escolhidos (com o valor, ou sem ele para usar o padrão); código, número de
 * destino, status, autoria e horário de criação vêm do banco. O banco também confere se o
 * canal é do usuário e se ele pode alterar valores. Faixa da validade personalizada:
 * conferida pelo banco com o relógio dele.
 */
export function parseCommercialLinkInput(raw: unknown): CommercialLinkInput {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  if (!isUuid(source.channelId)) throw validationError("Escolha o WhatsApp que vai receber os contatos deste link.");
  const label = normalizeLinkLabel(source.label);

  if (!isValidity(source.validity)) throw validationError("Escolha a validade do link.");
  let expiresAt: string | null = null;
  if (source.validity === "custom") {
    const instant =
      typeof source.date === "string" && typeof source.time === "string"
        ? zonedTimeToInstant(source.date, source.time)
        : null;
    if (!instant) throw validationError("Informe uma data e um horário de expiração válidos.");
    expiresAt = instant.toISOString();
  }

  // Ausente = particular (o padrão do banco).
  const tier = source.tier ?? "private";
  if (tier !== "private" && tier !== "corporate") throw validationError("Escolha se o evento é particular ou corporativo.");

  if (!Array.isArray(source.items) || source.items.length === 0) {
    throw validationError("Escolha ao menos um modelo de show.");
  }
  const seen = new Set<string>();
  const items = source.items.map((item) => {
    const entry = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    if (!isUuid(entry.modelId) || seen.has(entry.modelId)) throw validationError("Modelo de show inválido ou repetido.");
    seen.add(entry.modelId);
    // Sem valor (null/ausente): o banco grava o preço padrão vigente.
    if (entry.price === null || entry.price === undefined) return { modelId: entry.modelId, price: null };
    const price = typeof entry.price === "string" || typeof entry.price === "number" ? parsePrice(entry.price) : null;
    if (price === null) throw validationError("Informe um valor válido em reais, maior que zero, para cada modelo.");
    return { modelId: entry.modelId, price };
  });

  return { channelId: source.channelId, label, validity: source.validity, expiresAt, tier, items };
}
