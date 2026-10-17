import { toAgendaError } from "@/lib/agenda/errors";
import type { AgendaClient } from "@/lib/supabase/client";
import type { SellerLink, SellerLinkStatus } from "./types";

/**
 * Resolução pública dos códigos de link comercial (/p/<código>). Só status, WhatsApp de
 * destino e expiração: nada de vendedor, canal ou valores.
 */

const LINK_STATUSES = new Set<SellerLinkStatus>(["active", "inactive", "expired", "revoked", "invalid"]);

/** Situação do código e, se ativo, o WhatsApp e a expiração. Inexistente → null. */
export async function getSellerLink(client: AgendaClient, code: string): Promise<SellerLink | null> {
  const { data, error } = await client.rpc("get_seller_link", { p_code: code });
  if (error) throw toAgendaError(error, "Não foi possível verificar o link.");
  const row = data[0];
  if (!row) return null;
  // Desconhecido nunca vira "ativo".
  const status: SellerLinkStatus = LINK_STATUSES.has(row.status as SellerLinkStatus) ? (row.status as SellerLinkStatus) : "inactive";
  const active = row.active === true && status === "active";
  return {
    status,
    active,
    whatsapp: active ? (row.whatsapp ?? null) : null,
    expiresAt: active ? (row.expires_at ?? null) : null,
  };
}
