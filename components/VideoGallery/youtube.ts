/**
 * Links do YouTube → ID do vídeo (11 caracteres). Aceita os formatos que o YouTube gera:
 *   https://www.youtube.com/watch?v=ID   (com ou sem &t=, &list=...)
 *   https://youtu.be/ID                  (botão "Compartilhar")
 *   https://www.youtube.com/shorts/ID · /embed/ID · /live/ID
 *   ou só o ID
 */
const ID = /^[\w-]{11}$/;

export function parseYouTubeId(link: string): string | null {
  const value = link.trim();
  if (ID.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;

  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, kind, pathId] = url.pathname.split("/");
    id = kind === "watch" ? url.searchParams.get("v") : ["shorts", "embed", "live"].includes(kind) ? pathId : null;
  }

  return id && ID.test(id) ? id : null;
}

/**
 * Player embutido (domínio sem cookies até dar play). autoplay=1 porque o iframe só é
 * criado depois do clique no play do card.
 */
export function youTubeEmbedUrl(id: string) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
}

/** Thumbnail oficial do vídeo (existe para todo vídeo; 480×360). */
export function youTubeThumbnailUrl(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
