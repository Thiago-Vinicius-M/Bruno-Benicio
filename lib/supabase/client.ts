import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

export type AgendaClient = SupabaseClient<Database>;

/**
 * Cliente para Client Components (painel). Sessão em cookies, compartilhada com o
 * servidor. `createBrowserClient` já reaproveita a mesma instância no navegador.
 */
export function getSupabaseBrowserClient(): AgendaClient {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
