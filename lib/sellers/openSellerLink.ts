import { NextResponse, type NextRequest } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { resolveSellerLink } from "./resolveSellerLink";
import { INVALID_LINK_PATH, SELLER_COOKIE } from "./sellerLink";

/**
 * Abertura de um link comercial (/p/<código>; /r/<código> nos links já distribuídos),
 * enviado pelo WhatsApp. Confere o código no banco, associa a navegação ao link (cookie,
 * sem dados pessoais) e abre o site. Link expirado, desativado ou sem WhatsApp → site
 * público, sem preços. Código malformado, inexistente ou banco fora do ar → página de link
 * inválido. Fora do caso válido, desfaz qualquer associação anterior.
 */
export async function openSellerLink(request: NextRequest, code: string): Promise<NextResponse> {
  const result = await resolveSellerLink(createSupabasePublicClient, code);

  const target =
    result.status === "invalid"
      ? new URL(`${INVALID_LINK_PATH}?motivo=${result.reason}`, request.url)
      : new URL("/", request.url);
  const response = NextResponse.redirect(target, 303);
  // Cada abertura do link é decidida de novo (link expirado ou desativado, canal sem WhatsApp).
  response.headers.set("Cache-Control", "private, no-store");

  if (result.status === "ok") {
    response.cookies.set(SELLER_COOKIE, result.code, {
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      // Lido pela seção NOSSO SHOW só para saber que deve pedir a versão comercial ao
      // servidor; preços e destino do WhatsApp são sempre resolvidos no servidor.
      httpOnly: false,
      // Link temporário: o cookie não dura além da validade (medida complementar; o
      // servidor confere a validade a cada uso). Permanente: cookie de sessão.
      ...(result.expiresAt && { maxAge: secondsUntil(result.expiresAt) }),
    });
  } else {
    response.cookies.delete(SELLER_COOKIE);
  }
  return response;
}

/** Segundos inteiros até o instante (pelo menos 1: o banco acabou de confirmar a validade). */
const secondsUntil = (iso: string) => Math.max(1, Math.floor((Date.parse(iso) - Date.now()) / 1000));
