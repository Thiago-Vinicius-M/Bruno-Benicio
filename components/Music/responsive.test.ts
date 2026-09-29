import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * O jsdom não calcula layout, então a responsividade é verificada pela ESTRUTURA do CSS:
 * as regras que garantem o comportamento em cada faixa de largura precisam existir.
 */
const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const musicCss = read("./Music.module.css");
const playerCss = read("../SpotifyPlayer/SpotifyPlayer.module.css");

/** Conteúdo do bloco @media (query) { ... } — com chaves aninhadas. */
function mediaBlock(css: string, query: string) {
  const start = css.indexOf(`@media ${query}`);
  if (start < 0) return "";
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  return "";
}

describe("responsividade (estrutura do CSS)", () => {
  it("o player ocupa a largura do container, sem largura fixa", () => {
    expect(playerCss).toMatch(/\.player\s*{[^}]*width:\s*100%/);
    expect(playerCss).toMatch(/\.frame\s*{[^}]*width:\s*100%/);
  });

  it("variante adaptive usa o player compacto no celular", () => {
    const mobile = mediaBlock(playerCss, "(max-width: 767px)");
    expect(mobile).toMatch(/\[data-variant="adaptive"\][^}]*--spotify-height:\s*152px/);
  });

  it("desktop em duas colunas; tablet e celular empilhados", () => {
    expect(musicCss).toMatch(/\.layout\s*{[^}]*grid-template-columns:\s*minmax\(0, 1\.15fr\) minmax\(0, 1fr\)/);
    expect(mediaBlock(musicCss, "(max-width: 1023px)")).toMatch(
      /\.layout\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(mediaBlock(musicCss, "(max-width: 767px)")).toMatch(
      /\.tracks\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
  });

  it("a luz decorativa não gera scroll horizontal", () => {
    expect(musicCss).toMatch(/\.music\s*{[^}]*overflow-x:\s*clip/);
    expect(musicCss).toMatch(/\.glow\s*{[^}]*pointer-events:\s*none/);
  });

  it("nenhuma largura fixa maior que um celular pequeno (320px)", () => {
    for (const css of [musicCss, playerCss]) {
      for (const [, px] of css.matchAll(/(?:^|[\s;{])(?:min-)?width:\s*(\d+)px/g)) {
        expect(Number(px)).toBeLessThanOrEqual(320);
      }
    }
  });

  it("transições desligadas com prefers-reduced-motion", () => {
    expect(mediaBlock(musicCss, "(prefers-reduced-motion: reduce)")).toMatch(/transition:\s*none/);
  });
});
