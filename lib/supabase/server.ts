import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { AgendaClient } from "./client";
import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

/**
 * Cliente com a sessão do usuário (cookies) para Server Components, Server Actions
 * e Route Handlers. Crie um por requisição; nunca compartilhe entre requisições.
 * Todas as consultas rodam como o usuário logado, portanto sujeitas ao RLS.
 */
export async function createSupabaseServerClient(): Promise<AgendaClient> {
  const { url, publishableKey } = getSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components não podem gravar cookies. É esperado: o proxy.ts renova
          // a sessão antes da renderização, então nenhuma atualização se perde.
        }
      },
    },
  });
}
