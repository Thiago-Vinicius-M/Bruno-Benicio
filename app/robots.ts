import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

/** Site público indexável; painel, callbacks de autenticação e links comerciais ficam de fora. */
export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/painel", "/auth", "/p/", "/r/", "/link-invalido"] },
    ...(site && { sitemap: new URL("/sitemap.xml", site).href }),
  };
}
