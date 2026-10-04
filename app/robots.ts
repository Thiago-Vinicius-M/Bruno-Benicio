import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

/** Site público indexável; painel e callbacks de autenticação ficam de fora. */
export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/painel", "/auth"] },
    ...(site && { sitemap: new URL("/sitemap.xml", site).href }),
  };
}
