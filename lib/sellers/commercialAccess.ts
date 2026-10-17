import { getCommercialShowModels } from "@/lib/showModels/showModelsRepository";
import type { CommercialShowModel } from "@/lib/showModels/types";
import type { AgendaClient } from "@/lib/supabase/client";
import { isValidWhatsApp } from "@/lib/whatsapp";
import { isSellerCode } from "./sellerLink";
import { getSellerLink } from "./sellersRepository";

/**
 * Versão comercial de NOSSO SHOW: libera os valores e a escolha do formato só depois de
 * o servidor conferir, no banco, que o código é de um link ativo com WhatsApp
 * válido (e, se for um link temporário, que ele está ativo e dentro da validade). O
 * navegador nunca recebe preços sem essa verificação.
 *
 *   commercial → modelos com os valores gravados no link; expiresInMs: quanto falta para
 *                ele expirar
 *   none       → acesso sem link comercial (versão pública)
 *   expired    → link temporário expirado (versão pública, sem os valores negociados)
 *   inactive   → link inexistente, desativado ou sem WhatsApp disponível (não libera nada)
 *   error      → banco fora do ar (não libera nada; o site continua)
 */
export type CommercialAccess =
  | { status: "commercial"; models: CommercialShowModel[]; expiresInMs: number | null }
  | { status: "none" }
  | { status: "expired" }
  | { status: "inactive" }
  | { status: "error" };

export async function loadCommercialAccess(
  client: () => AgendaClient,
  sellerCode: string | null | undefined,
  now: () => number = Date.now,
): Promise<CommercialAccess> {
  if (!isSellerCode(sellerCode)) return { status: "none" };

  try {
    const db = client();
    const [seller, models] = await Promise.all([getSellerLink(db, sellerCode), getCommercialShowModels(db, sellerCode)]);
    if (seller?.status === "expired") return { status: "expired" };
    if (seller?.status === "invalid") console.error("[link comercial] link temporário sem preços", sellerCode);
    if (!seller?.active || !isValidWhatsApp(seller.whatsapp)) return { status: "inactive" };
    const expiresInMs = seller.expiresAt ? Math.max(0, Date.parse(seller.expiresAt) - now()) : null;
    return { status: "commercial", models, expiresInMs };
  } catch (error) {
    console.error("[link comercial] falha ao carregar a versão comercial", error);
    return { status: "error" };
  }
}
