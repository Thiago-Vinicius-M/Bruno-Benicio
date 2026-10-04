import type { NextRequest } from "next/server";
import { panelRedirect } from "@/lib/painel/routes";
import { redirectWithSession, updateSupabaseSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { response, isAuthenticated } = await updateSupabaseSession(request);

  // Checagem otimista (só a sessão). Perfil/desativação são verificados nas páginas.
  const target = panelRedirect(request.nextUrl.pathname, isAuthenticated);
  if (!target) return response;
  return redirectWithSession(response, new URL(target, request.url));
}

export const config = {
  // Somente áreas autenticadas (painel e callbacks de auth). O site público não passa por aqui.
  matcher: ["/painel/:path*", "/auth/:path*"],
};
