import type { AgendaClient } from "@/lib/supabase/client";
import { toAgendaError, unwrap } from "./errors";

/**
 * Interruptor da agenda no site público (linha única de agenda_settings). Autoria e
 * horário da alteração são definidos pelo banco (trigger).
 */

const NOT_FOUND = "Configuração da agenda não encontrada.";

/** Painel: a agenda está visível no site? */
export async function getAgendaPublicEnabled(client: AgendaClient): Promise<boolean> {
  const row = unwrap(await client.from("agenda_settings").select("public_enabled").eq("id", true).single(), NOT_FOUND);
  return row.public_enabled;
}

export async function setAgendaPublicEnabled(client: AgendaClient, enabled: boolean): Promise<boolean> {
  const row = unwrap(
    await client
      .from("agenda_settings")
      .update({ public_enabled: enabled })
      .eq("id", true)
      .select("public_enabled")
      .single(),
    NOT_FOUND,
  );
  return row.public_enabled;
}

/** Site público: somente `get_public_agenda_settings` (sem a linha → desabilitada). */
export async function getPublicAgendaEnabled(client: AgendaClient): Promise<boolean> {
  const { data, error } = await client.rpc("get_public_agenda_settings");
  if (error) throw toAgendaError(error, "Não foi possível carregar a agenda.");
  return data[0]?.public_enabled ?? false;
}
