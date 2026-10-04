import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

export type SessionUpdate = {
  response: NextResponse;
  /** Há uma sessão com JWT válido. Serve só para redirecionamentos otimistas. */
  isAuthenticated: boolean;
};

/**
 * Renova a sessão do Supabase (refresh token) antes da renderização e grava os
 * cookies atualizados na resposta. Não faz autorização: isso é papel do RLS e
 * das checagens dentro de cada Server Action/DAL (perfil e papel vêm do banco).
 */
export async function updateSupabaseSession(request: NextRequest): Promise<SessionUpdate> {
  const { url, publishableKey } = getSupabasePublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Cache-Control: no-store etc. — resposta com cookie de sessão não pode ir para CDN.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Precisa ser chamado aqui, antes de devolver a resposta, para o refresh acontecer.
  const { data } = await supabase.auth.getClaims();

  return { response, isAuthenticated: Boolean(data?.claims?.sub) };
}

/**
 * Redireciona sem perder a sessão: copia para o redirect os cookies (e os headers de
 * cache) que o refresh acabou de gravar na resposta original.
 */
export function redirectWithSession(session: NextResponse, url: URL): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of session.cookies.getAll()) redirect.cookies.set(cookie);
  const cacheControl = session.headers.get("Cache-Control");
  if (cacheControl) redirect.headers.set("Cache-Control", cacheControl);
  return redirect;
}
