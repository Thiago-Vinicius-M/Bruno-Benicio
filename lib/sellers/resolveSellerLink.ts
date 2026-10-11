import type { AgendaClient } from "@/lib/supabase/client";
import { normalizeSellerCode, type InvalidLinkReason } from "./sellerLink";
import { getSellerLink } from "./sellersRepository";

/**
 * Abertura do link /r/<código>: decide se o link libera a versão comercial.
 * Regra documentada em sellerLink.ts (o último link válido aberto prevalece).
 */

export type LinkResolution = { status: "ok"; code: string } | { status: "invalid"; reason: InvalidLinkReason };

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
  if (!seller.active) return { status: "invalid", reason: "inativo" };
  return { status: "ok", code };
}
