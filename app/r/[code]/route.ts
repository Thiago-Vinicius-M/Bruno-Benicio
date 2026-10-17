import type { NextRequest } from "next/server";
import { openSellerLink } from "@/lib/sellers/openSellerLink";

/**
 * Endereço antigo dos links comerciais (/r/<código>). Continua funcionando para os links
 * já distribuídos; os novos são gerados como /p/<código>. Mesma regra de abertura.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  return openSellerLink(request, code);
}
