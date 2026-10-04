import { validationError } from "./errors";

/** Mesmo formato da constraint `shows_venue_instagram_format` no banco. */
const HANDLE_PATTERN = /^[a-z0-9._]{1,30}$/;

/**
 * Normaliza o Instagram da casa para o username puro (`casaexemplo`).
 * Aceita `casaexemplo`, `@CasaExemplo` ou a URL do perfil. Vazio vira `null`.
 */
export function normalizeInstagramHandle(input: string | null | undefined): string | null {
  let value = (input ?? "").trim();
  if (!value) return null;

  const url = value.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i);
  if (url) value = url[1];

  value = value.replace(/^@/, "").toLowerCase();
  if (!HANDLE_PATTERN.test(value)) {
    throw validationError("Instagram inválido. Informe apenas o usuário, por exemplo: casaexemplo.");
  }
  return value;
}

/** Link do perfil, para a camada de apresentação. */
export const instagramProfileUrl = (handle: string) => `https://www.instagram.com/${handle}/`;
