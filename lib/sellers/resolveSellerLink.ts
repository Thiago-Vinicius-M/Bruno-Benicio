import type { AgendaClient } from "@/lib/supabase/client";
import { normalizeSellerCode, type InvalidLinkReason } from "./sellerLink";
import { getSellerLink } from "./sellersRepository";

/**
 * Abertura do link /p/<código> (ou /r/ nos antigos): decide se o link libera a versão
 * comercial. Regra documentada em sellerLink.ts (o último link válido aberto prevalece).
 *
 *   ok      → associa o código até a expiração do link
 *   public  → link expirado, desativado, sem WhatsApp ou inconsistente: site público,
 *             sem preços (nem os negociados antes) e sem página de erro
 *   invalid → código malformado/inexistente ou banco fora do ar: página de link inválido
 */

export type LinkResolution =
  | { status: "ok"; code: string; expiresAt: string | null }
  | { status: "public" }
  | { status: "invalid"; reason: InvalidLinkReason };

export async function resolveSellerLink(
  client: AgendaClient | (() => AgendaClient),
  rawCode: unknown,
): Promise<LinkResolution> {
  const code = normalizeSellerCode(rawCode);
  if (!code) return { status: "invalid", reason: "malformado" };

  let seller: Awaited<ReturnType<typeof getSellerLink>>;
  try {
    const db = typeof client === "function" ? client() : client;
    seller = await getSellerLink(db, code);
  } catch (error) {
    console.error("[link comercial] falha ao verificar o link", error);
    return { status: "invalid", reason: "indisponivel" };
  }
  if (!seller) return { status: "invalid", reason: "inexistente" };
  if (seller.active) return { status: "ok", code, expiresAt: seller.expiresAt };
  if (seller.status === "invalid") console.error("[link comercial] link sem preços", code);
  return { status: "public" };
}
