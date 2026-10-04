import "server-only";

/**
 * Endereço público do site (origem, sem barra final), para URLs absolutas: canônica,
 * Open Graph, sitemap/robots e links enviados por e-mail pelo Supabase Auth.
 *
 * Ordem: `SITE_URL` (definida pelo projeto) → domínio de produção da Vercel (em produção)
 * → URL do deploy (previews). Fora da Vercel e sem `SITE_URL`, devolve `undefined` e
 * quem chama decide o fallback (ex.: o host da requisição).
 */
export function getSiteUrl(): URL | undefined {
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) return parseSiteUrl(explicit);

  const vercelHost =
    process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : process.env.VERCEL_URL;
  return vercelHost ? new URL(`https://${vercelHost}`) : undefined;
}

export function parseSiteUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`SITE_URL inválida: "${value}". Use a URL completa, ex.: https://www.dominio.com.br`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`SITE_URL precisa começar com https:// (recebido: "${value}").`);
  }
  return new URL(url.origin);
}
