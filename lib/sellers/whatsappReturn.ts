import { buildContractMessage } from "@/lib/showModels/contractMessage";
import { parseEventDate, parseEventTime } from "@/lib/showModels/eventSchedule";
import { toCents } from "@/lib/showModels/price";
import { getCommercialShowModels } from "@/lib/showModels/showModelsRepository";
import type { AgendaClient } from "@/lib/supabase/client";
import { isValidWhatsApp, whatsappUrl } from "@/lib/whatsapp";
import { isSellerCode } from "./sellerLink";
import { getSellerLink } from "./sellersRepository";

/**
 * "Voltar ao WhatsApp" (seção NOSSO SHOW). Roda no servidor: o destino vem do cadastro
 * do vendedor do link (cookie), nunca do navegador; nome e valor vêm do banco (versão
 * comercial, que só responde para vendedor ativo) e precisam ser os mesmos que o
 * contratante viu. Data e horário são opcionais e validados. Sem tudo válido, não há URL.
 */

export type WhatsAppReturnProblem =
  | "invalid"
  | "invalid-schedule"
  | "no-seller"
  | "seller-inactive"
  | "model-unavailable"
  | "model-changed"
  | "unavailable";

export type WhatsAppReturnResult =
  | { status: "ready"; url: string }
  | { status: "error"; reason: WhatsAppReturnProblem; message: string };

export const WHATSAPP_RETURN_MESSAGES: Record<WhatsAppReturnProblem, string> = {
  invalid: "Escolha um dos formatos de show acima.",
  "invalid-schedule": "Confira a data e o horário do evento (os dois são opcionais).",
  "no-seller":
    "Não identificamos o atendimento deste acesso. Abra novamente o link que você recebeu ou fale com a gente pelos contatos abaixo.",
  "seller-inactive": "Este link de atendimento não está mais ativo. Fale com a gente pelos contatos abaixo.",
  "model-unavailable": "Este formato não está mais disponível. Atualize a página para ver os formatos atuais.",
  "model-changed": "Este formato foi atualizado. Atualize a página para ver o nome e o valor atuais.",
  unavailable: "Não foi possível preparar a mensagem agora. Tente novamente em instantes.",
};

const fail = (reason: WhatsAppReturnProblem, message = WHATSAPP_RETURN_MESSAGES[reason]): WhatsAppReturnResult => ({
  status: "error",
  reason,
  message,
});

/** O que o navegador envia: o modelo escolhido, o nome/valor que estavam na tela e a data/horário opcionais. */
export type WhatsAppReturnRequest = {
  modelId: string;
  name: string;
  price: number;
  date: string | null;
  time: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ParsedWhatsAppReturnRequest =
  | { ok: true; request: WhatsAppReturnRequest }
  | { ok: false; reason: "invalid" | "invalid-schedule"; message?: string };

export function parseWhatsAppReturnRequest(raw: unknown): ParsedWhatsAppReturnRequest {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const { modelId, name, price } = source;
  if (typeof modelId !== "string" || !UUID.test(modelId)) return { ok: false, reason: "invalid" };
  if (typeof name !== "string" || !name.trim()) return { ok: false, reason: "invalid" };
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return { ok: false, reason: "invalid" };

  const date = parseEventDate(source.date);
  if (!date.ok) return { ok: false, reason: "invalid-schedule", message: date.message };
  const time = parseEventTime(source.time);
  if (!time.ok) return { ok: false, reason: "invalid-schedule", message: time.message };

  return { ok: true, request: { modelId, name, price, date: date.value, time: time.value } };
}

export async function prepareWhatsAppReturn(
  client: () => AgendaClient,
  sellerCode: string | null | undefined,
  raw: unknown,
): Promise<WhatsAppReturnResult> {
  const parsed = parseWhatsAppReturnRequest(raw);
  if (!parsed.ok) return fail(parsed.reason, parsed.message);
  const { request } = parsed;
  if (!isSellerCode(sellerCode)) return fail("no-seller");

  let seller: Awaited<ReturnType<typeof getSellerLink>>;
  let models: Awaited<ReturnType<typeof getCommercialShowModels>>;
  try {
    const db = client();
    [seller, models] = await Promise.all([getSellerLink(db, sellerCode), getCommercialShowModels(db, sellerCode)]);
  } catch (error) {
    console.error("[whatsapp] falha ao preparar o retorno", error);
    return fail("unavailable");
  }

  if (!seller?.active || !isValidWhatsApp(seller.whatsapp)) return fail("seller-inactive");

  const model = models.find((item) => item.id === request.modelId);
  if (!model) return fail("model-unavailable");
  if (model.name !== request.name || toCents(model.price) !== toCents(request.price)) return fail("model-changed");

  return {
    status: "ready",
    url: whatsappUrl(seller.whatsapp, buildContractMessage(model, { date: request.date, time: request.time })),
  };
}
