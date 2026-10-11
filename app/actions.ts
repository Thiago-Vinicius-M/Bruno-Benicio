"use server";

import { cookies } from "next/headers";
import { loadCommercialAccess, type CommercialAccess } from "@/lib/sellers/commercialAccess";
import { SELLER_COOKIE } from "@/lib/sellers/sellerLink";
import { prepareWhatsAppReturn, type WhatsAppReturnResult } from "@/lib/sellers/whatsappReturn";
import { createSupabasePublicClient } from "@/lib/supabase/public";

/*
 * Ações do site público (sem login). Server Actions são endpoints públicos: só leem o
 * que `anon` já lê (funções públicas do banco) e não gravam nada no banco. O vendedor
 * vem sempre do cookie gravado pelo link comercial (/r/<código>), conferido no banco.
 */

/**
 * Versão comercial de NOSSO SHOW: valores e escolha do formato. Só responde com preços
 * para o vendedor ativo do cookie. Vendedor desativado/inexistente: o cookie é apagado
 * e a navegação volta a ser a pública (nunca passa para outro vendedor).
 */
export async function loadCommercialShowModelsAction(): Promise<CommercialAccess> {
  const jar = await cookies();
  const access = await loadCommercialAccess(createSupabasePublicClient, jar.get(SELLER_COOKIE)?.value);
  if (access.status === "inactive") jar.delete(SELLER_COOKIE);
  return access;
}

/**
 * Prepara o link "Voltar ao WhatsApp" para o modelo escolhido em NOSSO SHOW. O número,
 * o nome e o valor vêm do banco; data e horário (opcionais) são validados aqui.
 */
export async function prepareWhatsAppAction(input: unknown): Promise<WhatsAppReturnResult> {
  const sellerCode = (await cookies()).get(SELLER_COOKIE)?.value;
  return prepareWhatsAppReturn(createSupabasePublicClient, sellerCode, input);
}
