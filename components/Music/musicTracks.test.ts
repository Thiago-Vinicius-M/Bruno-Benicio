import { describe, expect, it } from "vitest";
import { isSpotifyTrackId } from "@/components/SpotifyPlayer/spotifyEmbed";
import { MUSIC_TRACKS, SPOTIFY_ARTIST_URL } from "./musicTracks";

describe("musicTracks", () => {
  it("todas as músicas têm Track ID válido e nome", () => {
    for (const track of MUSIC_TRACKS) {
      expect(isSpotifyTrackId(track.id), track.id).toBe(true);
      expect(track.title.trim()).not.toBe("");
    }
  });

  it("não repete músicas (o id é a key da lista)", () => {
    const ids = MUSIC_TRACKS.map((track) => track.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("aponta para o perfil oficial do artista", () => {
    expect(SPOTIFY_ARTIST_URL).toMatch(/^https:\/\/open\.spotify\.com\/artist\/[0-9A-Za-z]{22}$/);
  });
});
