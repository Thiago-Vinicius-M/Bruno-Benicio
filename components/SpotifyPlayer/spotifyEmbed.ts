/**
 * Integração com o Spotify Embed oficial — funções puras, sem React e sem acesso ao DOM.
 * Docs: https://developer.spotify.com/documentation/embeds
 *
 * O Track ID é o trecho final do link da música:
 *   https://open.spotify.com/track/3ISf1oztSc4M7Fj8tex0FP → "3ISf1oztSc4M7Fj8tex0FP"
 */

/** IDs do Spotify: 22 caracteres base62 (letras e números). */
const SPOTIFY_ID_PATTERN = /^[0-9A-Za-z]{22}$/;

/**
 * "dark" → fundo escuro fixo do player (combina com o site) ·
 * "cover" → cor de fundo tirada da capa da música (padrão do Spotify)
 */
export type SpotifyEmbedTheme = "dark" | "cover";

export function isSpotifyTrackId(value: unknown): value is string {
  return typeof value === "string" && SPOTIFY_ID_PATTERN.test(value);
}

/** URL do iframe oficial, ou null se o Track ID for inválido. */
export function buildSpotifyEmbedUrl(trackId: unknown, theme: SpotifyEmbedTheme = "dark"): string | null {
  if (!isSpotifyTrackId(trackId)) return null;
  const url = new URL(`https://open.spotify.com/embed/track/${trackId}`);
  url.searchParams.set("utm_source", "generator");
  if (theme === "dark") url.searchParams.set("theme", "0");
  return url.toString();
}

/** Link público da música no Spotify, ou null se o Track ID for inválido. */
export function buildSpotifyTrackUrl(trackId: unknown): string | null {
  return isSpotifyTrackId(trackId) ? `https://open.spotify.com/track/${trackId}` : null;
}
