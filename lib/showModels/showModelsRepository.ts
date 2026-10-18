import { toAgendaError, unwrap } from "@/lib/agenda/errors";
import type { AgendaClient } from "@/lib/supabase/client";
import { toShowModelRow } from "./modelInput";
import type {
  CommercialShowModel,
  PublicShowModel,
  ShowModel,
  ShowModelInput,
  ShowModelMoveDirection,
} from "./types";

/**
 * Modelos de show do painel (somente ADMIN, pelo RLS). Autoria, timestamps e posição
 * são definidos pelo banco (trigger); este módulo nunca envia created_by/updated_by/position.
 * Recebe o cliente por parâmetro: funciona com o cliente do navegador ou do servidor.
 */

const COLUMNS =
  "id, name, duration, description, price, corporate_price, active, position, created_by, updated_by, created_at, updated_at";

const NOT_FOUND = "Modelo de show não encontrado.";

/** numeric chega como número pelo PostgREST; a conversão protege contra string. */
const withNumericPrice = <T extends { price: number }>(row: T): T => ({ ...row, price: Number(row.price) });
const withNumericPrices = (row: ShowModel): ShowModel => ({
  ...withNumericPrice(row),
  corporate_price: Number(row.corporate_price),
});

/** Todos os modelos (ativos e inativos), na ordem de exibição. */
export async function listShowModels(client: AgendaClient): Promise<ShowModel[]> {
  const { data, error } = await client
    .from("show_models")
    .select(COLUMNS)
    .order("position")
    .order("created_at")
    .order("id");
  if (error) throw toAgendaError(error);
  return data.map(withNumericPrices);
}

export async function createShowModel(client: AgendaClient, input: ShowModelInput): Promise<ShowModel> {
  const row = { ...toShowModelRow(input), active: input.active ?? true };
  const created: ShowModel = unwrap(await client.from("show_models").insert(row).select(COLUMNS).single());
  return withNumericPrices(created);
}

/** Nome, duração, descrição e valor. A posição e o status não mudam aqui. */
export async function updateShowModel(client: AgendaClient, id: string, input: ShowModelInput): Promise<ShowModel> {
  const row = toShowModelRow(input);
  const updated: ShowModel = unwrap(
    await client.from("show_models").update(row).eq("id", id).select(COLUMNS).single(),
    NOT_FOUND,
  );
  return withNumericPrices(updated);
}

/** Inativo sai do site, mas continua cadastrado (pode ser reativado). */
export async function setShowModelActive(client: AgendaClient, id: string, active: boolean): Promise<ShowModel> {
  const updated: ShowModel = unwrap(
    await client.from("show_models").update({ active }).eq("id", id).select(COLUMNS).single(),
    NOT_FOUND,
  );
  return withNumericPrices(updated);
}

/** Sobe/desce uma posição na ordem de exibição. */
export async function moveShowModel(client: AgendaClient, id: string, direction: ShowModelMoveDirection): Promise<void> {
  const { error } = await client.rpc("move_show_model", { p_id: id, p_direction: direction });
  if (error) throw toAgendaError(error);
}

/** Site público: somente `get_public_show_models` (ativos, sem auditoria e sem preço). */
export async function getPublicShowModels(client: AgendaClient): Promise<PublicShowModel[]> {
  const { data, error } = await client.rpc("get_public_show_models");
  if (error) throw toAgendaError(error, "Não foi possível carregar os formatos de show.");
  // Só as colunas públicas, mesmo que a função passe a devolver mais alguma no futuro.
  return data.map(({ id, name, duration, description }) => ({ id, name, duration, description }));
}

/**
 * Versão comercial: modelos e valores gravados num link válido (o banco confere).
 * Código inválido, expirado, desativado ou sem WhatsApp → lista vazia.
 */
export async function getCommercialShowModels(client: AgendaClient, sellerCode: string): Promise<CommercialShowModel[]> {
  const { data, error } = await client.rpc("get_commercial_show_models", { p_code: sellerCode });
  if (error) throw toAgendaError(error, "Não foi possível carregar os formatos de show.");
  return data.map(withNumericPrice);
}
