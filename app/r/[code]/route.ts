import { NextResponse, type NextRequest } from "next/server";
import { resolveSellerLink } from "@/lib/sellers/resolveSellerLink";
import { INVALID_LINK_PATH, SELLER_COOKIE } from "@/lib/sellers/sellerLink";
import { createSupabasePublicClient } from "@/lib/supabase/public";

/**
 * Link comercial do vendedor (/r/<código>), enviado pelo WhatsApp. Confere o código no
 * banco, associa a navegação ao vendedor (cookie de sessão, sem dados pessoais) e abre o
 * site. Código malformado, inexistente, de vendedor inativo ou banco
 * fora do ar → página de link inválido, desfazendo qualquer associação anterior.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  const result = await resolveSellerLink(createSupabasePublicClient, code);

  const target =
    result.status === "ok" ? new URL("/", request.url) : new URL(`${INVALID_LINK_PATH}?motivo=${result.reason}`, request.url);
  const response = NextResponse.redirect(target, 303);
  // Cada abertura do link é decidida de novo (vendedor pode ter sido desativado).
  response.headers.set("Cache-Control", "private, no-store");

  if (result.status === "ok") {
    response.cookies.set(SELLER_COOKIE, result.code, {
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      // Lido pela seção NOSSO SHOW só para saber que deve pedir a versão comercial ao
      // servidor; preços e destino do WhatsApp são sempre resolvidos no servidor.
      httpOnly: false,
    });
  } else {
    response.cookies.delete(SELLER_COOKIE);
  }
  return response;
}
