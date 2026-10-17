"use server";

import { cookies } from "next/headers";
import { loadCommercialAccess, type CommercialAccess } from "@/lib/sellers/commercialAccess";
import { SELLER_COOKIE } from "@/lib/sellers/sellerLink";
import { prepareWhatsAppReturn, type WhatsAppReturnResult } from "@/lib/sellers/whatsappReturn";
import { createSupabasePublicClient } from "@/lib/supabase/public";

/*
 * Ações do site público (sem login). Server Actions são endpoints públicos: só leem o
 * que `anon` já lê (funções públicas do banco) e não gravam nada no banco. O vendedor
 * vem sempre do cookie gravado pelo link comercial (/p/<código>), conferido no banco.
 */

/**
 * Versão comercial de NOSSO SHOW: valores e escolha do formato. Só responde com preços
 * para o link válido do cookie (link ativo, com WhatsApp disponível e dentro da
 * validade). Link expirado, desativado ou inexistente: o cookie é apagado e a navegação
 * volta a ser a pública (nunca passa para outro vendedor nem para outro link).
 */
export async function loadCommercialShowModelsAction(): Promise<CommercialAccess> {
  const jar = await cookies();
  const access = await loadCommercialAccess(createSupabasePublicClient, jar.get(SELLER_COOKIE)?.value);
  if (access.status === "inactive" || access.status === "expired") jar.delete(SELLER_COOKIE);
  return access;
}

/**
 * Prepara o link "Voltar ao WhatsApp" para o modelo escolhido em NOSSO SHOW. O número,
 * o nome e o valor vêm do banco (o preço do link temporário, quando for o caso); data e
 * horário (opcionais) são validados aqui. Link expirado ou desativado: bloqueado.
 */
export async function prepareWhatsAppAction(input: unknown): Promise<WhatsAppReturnResult> {
  const sellerCode = (await cookies()).get(SELLER_COOKIE)?.value;
  return prepareWhatsAppReturn(createSupabasePublicClient, sellerCode, input);
}
