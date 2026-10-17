import type { NextRequest } from "next/server";
import { openSellerLink } from "@/lib/sellers/openSellerLink";

/** Link comercial (/p/<código>), enviado pelo WhatsApp. Regra de abertura em openSellerLink. */
export async function GET(request: NextRequest, ctx: RouteContext<"/p/[code]">) {
  const { code } = await ctx.params;
  return openSellerLink(request, code);
}
