import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AgendaClient } from "./client";
import type { Database } from "./database.types";
import { getSupabasePublicEnv, isSecretKey } from "./env";

/**
 * Cliente com a SECRET KEY (ignora RLS). Uso restrito à API de administração do
 * Supabase Auth (convidar, banir usuários) em lib/agenda/usersAdmin.ts, sempre
 * depois de confirmar que quem chama é ADMIN.
 *
 * `server-only` faz o build falhar se este módulo for importado no cliente.
 */
export function createSupabaseAdminClient(): AgendaClient {
  const { url } = getSupabasePublicEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY não definida (somente no servidor; veja .env.example).");
  }
  if (!isSecretKey(secretKey)) {
    throw new Error("SUPABASE_SECRET_KEY não parece uma chave secreta (sb_secret_... ou service_role).");
  }
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
