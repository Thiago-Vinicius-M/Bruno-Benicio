import { toAgendaError, unwrap } from "@/lib/agenda/errors";
import type { AgendaClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type {
  CommercialLink,
  CommercialLinkInput,
  CommercialLinkPrice,
  CommercialLinkStatus,
  LinkModel,
  LinkPermissions,
} from "./types";

/**
 * Links comerciais (ADMIN e SELLER). Criação e desativação só pelas funções do banco: a
 * criação confere o canal (do próprio usuário e ativo) e a permissão de alterar valores,
 * grava o link e todos os preços numa transação; código, destino, status, autoria e
 * horário vêm do banco. Depois de criado, o link não muda (histórico).
 */

const STATUSES = new Set<CommercialLinkStatus>(["active", "expired", "revoked", "inactive"]);

const toNumberOrNull = (value: unknown) => (value === null || value === undefined ? null : Number(value));

/** Histórico (ADMIN: todos; SELLER: os próprios), mais recentes primeiro, com status do banco. */
export async function listCommercialLinks(client: AgendaClient): Promise<CommercialLink[]> {
  const { data, error } = await client.rpc("get_seller_links");
  if (error) throw toAgendaError(error, "Não foi possível carregar os links comerciais.");
  return data.map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label ?? null,
    created_by: row.created_by ?? null,
    created_by_name: row.created_by_name ?? null,
    created_at: row.created_at,
    expires_at: row.expires_at,
    deactivated_at: row.deactivated_at ?? null,
    // Desconhecido nunca vira "ativo".
    status: STATUSES.has(row.status as CommercialLinkStatus) ? (row.status as CommercialLinkStatus) : "revoked",
    channel_id: row.channel_id,
    channel_label: row.channel_label,
    whatsapp: row.whatsapp,
    destination: row.destination ?? null,
    prices: (Array.isArray(row.prices) ? (row.prices as CommercialLinkPrice[]) : []).map((price) => ({
      model_id: price.model_id,
      name: price.name,
      price: Number(price.price),
      default_price: toNumberOrNull(price.default_price),
    })),
  }));
}

/** Modelos ativos com o preço padrão atual (show_models.price), para montar a proposta. */
export async function listLinkModels(client: AgendaClient): Promise<LinkModel[]> {
  const { data, error } = await client.rpc("get_link_show_models");
  if (error) throw toAgendaError(error, "Não foi possível carregar os modelos de show.");
  return data.map((row) => ({ id: row.id, name: row.name, price: Number(row.price) }));
}

/** O que o usuário logado pode fazer no módulo. A regra fica só no banco. */
export async function getLinkPermissions(client: AgendaClient): Promise<LinkPermissions> {
  const { data, error } = await client.rpc("get_commercial_link_permissions");
  if (error) throw toAgendaError(error);
  const row = data[0];
  return { canCreate: row?.can_create === true, canCustomizePrices: row?.can_customize_prices === true };
}

export async function createCommercialLink(
  client: AgendaClient,
  input: CommercialLinkInput,
): Promise<{ id: string; code: string; expires_at: string }> {
  // O gerador de tipos marca todo argumento de função como não nulo; a função aceita
  // p_label e p_expires_at nulos (sem identificação; prazo predefinido).
  const args = {
    p_channel_id: input.channelId,
    p_label: input.label,
    p_validity: input.validity,
    p_expires_at: input.validity === "custom" ? input.expiresAt : null,
    // Sem price: o banco usa o preço padrão vigente.
    p_items: input.items.map((item) => (item.price === null ? { model_id: item.modelId } : { model_id: item.modelId, price: item.price })),
  } as Database["public"]["Functions"]["create_commercial_link"]["Args"];
  const rows = unwrap(await client.rpc("create_commercial_link", args));
  return unwrap({ data: rows[0], error: null }, "Não foi possível criar o link.");
}

/** Revoga o link antes da expiração (ADMIN: qualquer um; SELLER: os próprios). O histórico fica. */
export async function deactivateCommercialLink(client: AgendaClient, id: string): Promise<void> {
  const { error } = await client.rpc("deactivate_seller_link", { p_id: id });
  if (error) throw toAgendaError(error);
}
