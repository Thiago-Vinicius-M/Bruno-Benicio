import { getCommercialShowModels } from "@/lib/showModels/showModelsRepository";
import type { CommercialShowModel } from "@/lib/showModels/types";
import type { AgendaClient } from "@/lib/supabase/client";
import { isValidWhatsApp } from "@/lib/whatsapp";
import { isSellerCode } from "./sellerLink";
import { getSellerLink } from "./sellersRepository";

/**
 * Versão comercial de NOSSO SHOW: libera os valores e a escolha do formato só depois de
 * o servidor conferir, no banco, que o código do link é de um vendedor ativo com WhatsApp
 * válido. O navegador nunca recebe preços sem essa verificação.
 *
 *   commercial → modelos com valor
 *   none       → acesso sem link comercial (versão pública)
 *   inactive   → link de vendedor inexistente ou desativado (não libera nada)
 *   error      → banco fora do ar (não libera nada; o site continua)
 */
export type CommercialAccess =
  | { status: "commercial"; models: CommercialShowModel[] }
  | { status: "none" }
  | { status: "inactive" }
  | { status: "error" };

export async function loadCommercialAccess(
  client: () => AgendaClient,
  sellerCode: string | null | undefined,
): Promise<CommercialAccess> {
  if (!isSellerCode(sellerCode)) return { status: "none" };

  try {
    const db = client();
    const [seller, models] = await Promise.all([getSellerLink(db, sellerCode), getCommercialShowModels(db, sellerCode)]);
    if (!seller?.active || !isValidWhatsApp(seller.whatsapp)) return { status: "inactive" };
    return { status: "commercial", models };
  } catch (error) {
    console.error("[link comercial] falha ao carregar a versão comercial", error);
    return { status: "error" };
  }
}
