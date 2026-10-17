import { toAgendaError, unwrap } from "@/lib/agenda/errors";
import type { AgendaClient } from "@/lib/supabase/client";
import { parseChannelInput, parseChannelUpdate } from "./channelInput";
import type { ChannelOwner, WhatsAppChannel } from "./types";

/**
 * Canais de WhatsApp. Leitura pelo RLS (ADMIN: todos; o dono: os próprios). Cadastro e
 * alteração só por ADMIN (RLS + trigger). Nunca apagados: desativa-se, com redirecionamento
 * opcional para outro canal ativo (os links que usavam o canal passam a usar esse número).
 */

const COLUMNS =
  "id, owner_id, whatsapp, label, active, is_primary, redirect_channel_id, created_by, updated_by, created_at, updated_at";

const NOT_FOUND = "WhatsApp não encontrado.";

/** Ativos primeiro; dentro deles, o principal; depois pela identificação. */
export async function listChannels(client: AgendaClient): Promise<WhatsAppChannel[]> {
  const { data, error } = await client
    .from("whatsapp_channels")
    .select(COLUMNS)
    .order("active", { ascending: false })
    .order("is_primary", { ascending: false })
    .order("label")
    .order("id");
  if (error) throw toAgendaError(error);
  return data;
}

/** ADMIN: usuários ativos (ADMIN/SELLER) que podem receber canais. */
export async function listChannelOwners(client: AgendaClient): Promise<ChannelOwner[]> {
  const { data, error } = await client.rpc("get_whatsapp_channel_owners");
  if (error) throw toAgendaError(error);
  return data.map((row) => ({ id: row.id, name: row.name, role: row.role }));
}

export async function createChannel(client: AgendaClient, raw: unknown): Promise<WhatsAppChannel> {
  const row = parseChannelInput(raw);
  return unwrap(await client.from("whatsapp_channels").insert(row).select(COLUMNS).single());
}

/** Identificação e principal. O número e o dono não mudam. */
export async function updateChannel(client: AgendaClient, id: string, raw: unknown): Promise<WhatsAppChannel> {
  const row = parseChannelUpdate(raw);
  return unwrap(await client.from("whatsapp_channels").update(row).eq("id", id).select(COLUMNS).single(), NOT_FOUND);
}

/**
 * Desativa o canal: nenhum link novo pode usá-lo. Os links já criados com ele passam a
 * mandar os contatos para `redirectTo` (canal ativo) ou, sem ele, ficam sem WhatsApp.
 * Também troca o redirecionamento de um canal já desativado.
 */
export async function deactivateChannel(client: AgendaClient, id: string, redirectTo: string | null): Promise<WhatsAppChannel> {
  return unwrap(
    await client
      .from("whatsapp_channels")
      .update({ active: false, redirect_channel_id: redirectTo })
      .eq("id", id)
      .select(COLUMNS)
      .single(),
    NOT_FOUND,
  );
}

/** Reativa: os links voltam ao número original e o redirecionamento é desfeito (pelo banco). */
export async function activateChannel(client: AgendaClient, id: string): Promise<WhatsAppChannel> {
  return unwrap(await client.from("whatsapp_channels").update({ active: true }).eq("id", id).select(COLUMNS).single(), NOT_FOUND);
}
