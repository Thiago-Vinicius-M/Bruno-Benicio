import { activateChannel, createChannel, deactivateChannel, updateChannel } from "@/lib/commercialLinks/channelsRepository";
import { parseCommercialLinkInput } from "@/lib/commercialLinks/linkInput";
import { createCommercialLink, deactivateCommercialLink } from "@/lib/commercialLinks/linksRepository";
import type { AgendaClient } from "@/lib/supabase/client";
import { isUuid, runAction, type ActionResult } from "./actionResult";

/**
 * Links comerciais: regras das operações do painel. Do navegador só vêm escolhas (canal,
 * modelos, valores, validade); código, destino, autoria e permissões são decididos pelo
 * banco (create_commercial_link, RLS e triggers). As Server Actions conferem o papel antes
 * (requirePanelLinkCreator / requirePanelAdmin).
 */

/** Criação: além da mensagem, o código gerado (para copiar o link na hora). */
export type CreateCommercialLinkResult =
  | { status: "success"; message: string; code: string }
  | { status: "error"; message: string };

const LINK_FALLBACK = "Não foi possível concluir a operação com o link. Tente novamente.";
const CHANNEL_FALLBACK = "Não foi possível salvar o WhatsApp. Tente novamente.";

export async function createCommercialLinkFromInput(client: AgendaClient, raw: unknown): Promise<CreateCommercialLinkResult> {
  let code = "";
  const result = await runAction(
    "links comerciais",
    async () => {
      code = (await createCommercialLink(client, parseCommercialLinkInput(raw))).code;
    },
    { success: "Link criado. Copie e envie para o cliente.", fallback: LINK_FALLBACK },
  );
  return result.status === "success" ? { ...result, code } : result;
}

/** Revoga o link antes da expiração; o histórico e os preços ficam. */
export const deactivateCommercialLinkById = async (client: AgendaClient, id: unknown): Promise<ActionResult> =>
  isUuid(id)
    ? runAction("links comerciais", () => deactivateCommercialLink(client, id), {
        success: "Link desativado: os valores dele não aparecem mais.",
        fallback: LINK_FALLBACK,
      })
    : { status: "error", message: "Link inválido." };

const invalidChannel: ActionResult = { status: "error", message: "WhatsApp inválido." };

export const createChannelFromInput = (client: AgendaClient, raw: unknown) =>
  runAction("canais de whatsapp", () => createChannel(client, raw), {
    success: "WhatsApp cadastrado. O usuário já pode escolhê-lo ao criar links.",
    fallback: CHANNEL_FALLBACK,
    duplicate: "Este número já está cadastrado para este usuário.",
  });

export const updateChannelFromInput = async (client: AgendaClient, id: unknown, raw: unknown) =>
  isUuid(id)
    ? runAction("canais de whatsapp", () => updateChannel(client, id, raw), {
        success: "WhatsApp atualizado.",
        fallback: CHANNEL_FALLBACK,
      })
    : invalidChannel;

/** `redirectTo`: canal ativo que passa a receber os contatos dos links deste canal (opcional). */
export const deactivateChannelById = async (client: AgendaClient, id: unknown, redirectTo: unknown) => {
  if (!isUuid(id) || (redirectTo !== null && !isUuid(redirectTo))) return invalidChannel;
  return runAction("canais de whatsapp", () => deactivateChannel(client, id, redirectTo), {
    success: redirectTo
      ? "WhatsApp desativado. Os links dele passam a enviar os contatos para o número escolhido."
      : "WhatsApp desativado. Os links criados com ele deixam de abrir conversa.",
    fallback: CHANNEL_FALLBACK,
  });
};

export const activateChannelById = async (client: AgendaClient, id: unknown) =>
  isUuid(id)
    ? runAction("canais de whatsapp", () => activateChannel(client, id), {
        success: "WhatsApp reativado. Os links dele voltam a usar este número.",
        fallback: CHANNEL_FALLBACK,
      })
    : invalidChannel;
