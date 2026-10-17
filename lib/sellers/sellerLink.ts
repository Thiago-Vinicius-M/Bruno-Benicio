/**
 * Link comercial (/p/<código>; /r/<código> nos antigos). Módulo sem dependências de
 * servidor: usado pela rota do link, pela Server Action do WhatsApp, pelo painel e pela
 * seção NOSSO SHOW.
 *
 * Regra de atribuição (determinística): só a abertura de um link muda a proposta da
 * navegação. Um link válido grava o código num cookie (que dura no máximo até a expiração
 * do link) e passa a ser o destino do "Voltar ao WhatsApp"; se outro link válido for
 * aberto depois, a navegação comercial passa para ele. Navegar pelo site sem link nunca
 * altera nada. Link malformado, inexistente ou sem como conferir → página de link inválido;
 * expirado, desativado ou sem WhatsApp disponível → site público, sem preços. Nos dois
 * casos o cookie é apagado. O cookie guarda só o código aleatório (nada pessoal) e não
 * autoriza nada sozinho: o servidor confere o código no banco a cada uso, e os preços vêm
 * sempre do banco para aquele código.
 */

export const SELLER_COOKIE = "bb_vendedor";

/** Prefixo dos links gerados. Os antigos (/r/<código>) continuam abrindo pela mesma regra. */
export const SELLER_LINK_PREFIX = "/p/";

/** Página de link inválido (`?motivo=`). */
export const INVALID_LINK_PATH = "/link-invalido";

export type InvalidLinkReason = "malformado" | "inexistente" | "indisponivel";

const CODE = /^[a-z0-9]{8,32}$/;

export const isSellerCode = (value: unknown): value is string => typeof value === "string" && CODE.test(value);

/** Código vindo da URL: tolera maiúsculas e espaços colados no fim (apps de mensagem). */
export function normalizeSellerCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const code = value.trim().toLowerCase();
  return isSellerCode(code) ? code : null;
}

export const sellerLinkPath = (code: string) => `${SELLER_LINK_PREFIX}${code}`;

export function sellerLinkUrl(origin: string, code: string): string {
  return new URL(sellerLinkPath(code), origin).href;
}

/** Código do vendedor gravado pelo link, lido de `document.cookie` (ou null). */
export function readSellerCookie(cookieHeader: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SELLER_COOKIE) return normalizeSellerCode(value.join("="));
  }
  return null;
}
