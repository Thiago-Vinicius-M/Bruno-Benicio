import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

/** O site público é uma página única; o painel não entra no sitemap. */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  return site ? [{ url: new URL("/", site).href }] : [];
}
