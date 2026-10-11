/**
 * Link comercial do vendedor (/r/<código>). Módulo sem dependências de servidor: usado
 * pela rota do link, pela Server Action do WhatsApp, pelo painel e pela seção NOSSO SHOW.
 *
 * Regra de atribuição (determinística): só a abertura de um link /r/<código> muda o
 * vendedor. Um link válido grava o código num cookie de sessão do navegador e passa a ser
 * o destino do "Voltar ao WhatsApp" — se outro link válido for aberto depois, a navegação
 * comercial passa para esse novo vendedor. Navegar pelo site sem link nunca altera nada.
 * Um link inválido (malformado, inexistente, de vendedor desativado ou sem como conferir)
 * apaga o cookie: o visitante fica na versão pública, sem preços e sem ser encaminhado a
 * outro vendedor. O cookie guarda só o código aleatório (nada pessoal) e some quando o
 * navegador é fechado. Ele não autoriza nada sozinho: o servidor confere o código no
 * banco a cada uso.
 */

export const SELLER_COOKIE = "bb_vendedor";

export const SELLER_LINK_PREFIX = "/r/";

/** Página de link inválido (`?motivo=`). */
export const INVALID_LINK_PATH = "/link-invalido";

export type InvalidLinkReason = "malformado" | "inexistente" | "inativo" | "indisponivel";

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
