/**
 * Músicas da seção MÚSICAS — a ordem da lista é a ordem na página; a primeira abre selecionada.
 *
 * id    → Track ID do Spotify: o trecho final do link da música
 *         (https://open.spotify.com/track/3ISf1oztSc4M7Fj8tex0FP → "3ISf1oztSc4M7Fj8tex0FP")
 * title → nome exibido na lista, igual ao do Spotify. Os atuais vieram do oEmbed oficial
 *         (https://open.spotify.com/oembed?url=<link da música>, campo "title").
 *
 * Trocar uma música: substitua id e title. Adicionar: inclua um novo item na lista.
 */
export type MusicTrack = {
  id: string;
  title: string;
};

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: "3ISf1oztSc4M7Fj8tex0FP", title: "Foi Deus" },
  { id: "05dlPNnAH8BOGwdzNAcX73", title: "Maneira Errada / Quem de Nós Dois" },
  { id: "66aHceSvEnoETv7vWisfQq", title: "Amigo" },
  { id: "44F7xAkkJkrkeYAV72UErZ", title: "SÓ PRO MEU PRAZER" },
];

/** Perfil oficial da dupla — destino do botão "Ouça mais no Spotify". */
export const SPOTIFY_ARTIST_URL = "https://open.spotify.com/artist/7duvobVoO9nHwyePl3ADvT";
