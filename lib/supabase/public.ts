import { createClient } from "@supabase/supabase-js";
import type { AgendaClient } from "./client";
import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

/**
 * Cliente anônimo, sem sessão, para o site público (Agenda). Não lê cookies, então
 * pode ser usado em Server Components cacheáveis. Pelo RLS, só alcança
 * `get_public_agenda`; nenhuma tabela é acessível a `anon`.
 */
export function createSupabasePublicClient(): AgendaClient {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
