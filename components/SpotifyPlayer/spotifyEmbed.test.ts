import { describe, expect, it } from "vitest";
import { buildSpotifyEmbedUrl, buildSpotifyTrackUrl, isSpotifyTrackId } from "./spotifyEmbed";

const ID = "3ISf1oztSc4M7Fj8tex0FP";

describe("spotifyEmbed", () => {
  it("monta a URL do embed oficial com tema escuro por padrão", () => {
    expect(buildSpotifyEmbedUrl(ID)).toBe(
      `https://open.spotify.com/embed/track/${ID}?utm_source=generator&theme=0`,
    );
  });

  it("tema 'cover' mantém as cores da capa (sem theme=0)", () => {
    expect(buildSpotifyEmbedUrl(ID, "cover")).toBe(
      `https://open.spotify.com/embed/track/${ID}?utm_source=generator`,
    );
  });

  it("monta o link público da música", () => {
    expect(buildSpotifyTrackUrl(ID)).toBe(`https://open.spotify.com/track/${ID}`);
  });

  it.each([undefined, null, "", "abc", `${ID}x`, `${ID.slice(0, 21)}/`, `${ID.slice(0, 20)}?a`, 42])(
    "rejeita Track ID inválido: %s",
    (value) => {
      expect(isSpotifyTrackId(value)).toBe(false);
      expect(buildSpotifyEmbedUrl(value)).toBeNull();
      expect(buildSpotifyTrackUrl(value)).toBeNull();
    },
  );
});
