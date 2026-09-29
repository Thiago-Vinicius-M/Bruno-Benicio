import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** O jsdom não calcula layout: a responsividade é verificada pela ESTRUTURA do CSS. */
const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const css = read("./VideoGallery.module.css");

describe("responsividade (estrutura do CSS)", () => {
  it("proporções vêm de aspect-ratio, não de alturas fixas", () => {
    expect(css).toMatch(/\[data-orientation="landscape"\]\s*{[^}]*aspect-ratio:\s*16 \/ 9/);
    expect(css).toMatch(/\[data-orientation="portrait"\]\s*{[^}]*aspect-ratio:\s*9 \/ 16/);
    expect(css).not.toMatch(/(?:^|[\s;{])height:\s*\d+px/);
  });

  it("nenhuma largura fixa maior que um celular pequeno (320px)", () => {
    for (const [, px] of css.matchAll(/(?:^|[\s;{])(?:min-)?width:\s*(\d+)px/g)) {
      expect(Number(px)).toBeLessThanOrEqual(320);
    }
  });

  it("vertical nunca é cortado (contain) e o player não deforma o vídeo", () => {
    expect(css).toMatch(/\[data-orientation="portrait"\] \.thumbnail\s*{[^}]*object-fit:\s*contain/);
    expect(css).toMatch(/\.player\s*{[^}]*object-fit:\s*contain/);
  });
});
