import { toAgendaError, unwrap } from "@/lib/agenda/errors";
import type { AgendaClient } from "@/lib/supabase/client";
import { toSellerRow } from "./sellerInput";
import type { Seller, SellerInput, SellerLink } from "./types";

/**
 * Vendedores do painel (somente ADMIN, pelo RLS). Código do link, autoria e timestamps
 * são definidos pelo banco (trigger); este módulo nunca envia code/created_by/updated_by.
 */

const COLUMNS = "id, name, whatsapp, code, active, created_by, updated_by, created_at, updated_at";

const NOT_FOUND = "Vendedor não encontrado.";

/** Ativos primeiro, depois por nome. */
export async function listSellers(client: AgendaClient): Promise<Seller[]> {
  const { data, error } = await client
    .from("sellers")
    .select(COLUMNS)
    .order("active", { ascending: false })
    .order("name")
    .order("id");
  if (error) throw toAgendaError(error);
  return data;
}

export async function createSeller(client: AgendaClient, input: SellerInput): Promise<Seller> {
  const row = toSellerRow(input);
  return unwrap(await client.from("sellers").insert(row).select(COLUMNS).single());
}

/** Nome e WhatsApp. O código (e portanto o link já compartilhado) não muda. */
export async function updateSeller(client: AgendaClient, id: string, input: SellerInput): Promise<Seller> {
  const row = toSellerRow(input);
  return unwrap(await client.from("sellers").update(row).eq("id", id).select(COLUMNS).single(), NOT_FOUND);
}

/** Inativo: o link deixa de funcionar, mas o cadastro continua (pode ser reativado). */
export async function setSellerActive(client: AgendaClient, id: string, active: boolean): Promise<Seller> {
  return unwrap(await client.from("sellers").update({ active }).eq("id", id).select(COLUMNS).single(), NOT_FOUND);
}

/** Site público: status do código do link (e o WhatsApp, se ativo). Inexistente → null. */
export async function getSellerLink(client: AgendaClient, code: string): Promise<SellerLink | null> {
  const { data, error } = await client.rpc("get_seller_link", { p_code: code });
  if (error) throw toAgendaError(error, "Não foi possível verificar o link.");
  const row = data[0];
  return row ? { active: row.active, whatsapp: row.active ? (row.whatsapp ?? null) : null } : null;
}
