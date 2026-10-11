import { describe, expect, it } from "vitest";
import { buildGalleryRows, buildLeadRows, LAYOUT, rowGeometry, unitVideos, type GalleryRow } from "./galleryLayout";
import type { GalleryVideo, VideoOrientation } from "./types";

const video = (id: string, orientation: VideoOrientation): GalleryVideo => ({
  id,
  type: "video",
  sourceType: "local",
  orientation,
  title: id,
});

/** "LLP" → horizontal, horizontal, vertical (ids L0, L1, P2). */
const sequence = (pattern: string) =>
  [...pattern].map((char, index) => video(`${char}${index}`, char === "L" ? "landscape" : "portrait"));

/** Linhas em texto: "L L | (L/L) P P". */
const describeRows = (rows: GalleryRow[]) =>
  rows
    .map((row) =>
      row.units
        .map((unit) => (unit.kind === "stack" ? "(L/L)" : unit.video.orientation === "landscape" ? "L" : "P"))
        .join(" "),
    )
    .join(" | ");

const layout = (pattern: string) => describeRows(buildGalleryRows(sequence(pattern)));

/** Todas as combinações de horizontais/verticais com até `max` vídeos. */
function* allSequences(max: number) {
  for (let n = 1; n <= max; n++) {
    for (let mask = 0; mask < 1 << n; mask++) {
      yield Array.from({ length: n }, (_, i) => ((mask >> i) & 1 ? "P" : "L")).join("");
    }
  }
}

describe("buildGalleryRows", () => {
  it("lista vazia → nenhuma linha", () => {
    expect(buildGalleryRows([])).toEqual([]);
  });

  it("composições típicas", () => {
    expect(layout("L")).toBe("L");
    expect(layout("LL")).toBe("L L");
    expect(layout("LP")).toBe("L P");
    expect(layout("LLLL")).toBe("L L | L L");
    // verticais grandes: dois por linha em vez de quatro estreitos
    expect(layout("PPPP")).toBe("P P | P P");
    expect(layout("PPP")).toBe("P P P");
    // três horizontais: um grande e um par, em vez de três pequenos
    expect(layout("LLL")).toBe("L | L L");
    // dois horizontais empilhados entre/ao lado de verticais
    expect(layout("LLPP")).toBe("(L/L) P P");
    // a lista que estava no site antes do painel
    expect(layout("LLPLLPP")).toBe("L L | P L | L P P");
  });

  it("mantém a ordem da lista (esquerda → direita, cima → baixo)", () => {
    for (const pattern of allSequences(8)) {
      const videos = sequence(pattern);
      const order = buildGalleryRows(videos).flatMap((row) => row.units.flatMap(unitVideos));
      expect(order.map((v) => v.id), pattern).toEqual(videos.map((v) => v.id));
    }
  });

  it("toda linha tem um card inteiro, no máximo 4 colunas, e pilhas só de horizontais", () => {
    for (const pattern of allSequences(8)) {
      for (const row of buildGalleryRows(sequence(pattern))) {
        expect(row.units.length, pattern).toBeLessThanOrEqual(LAYOUT.maxUnitsPerRow);
        expect(row.units.some((unit) => unit.kind === "single"), pattern).toBe(true);
        for (const unit of row.units) {
          if (unit.kind === "stack") expect(unit.videos.map((v) => v.orientation)).toEqual(["landscape", "landscape"]);
        }
      }
    }
  });

  it("nenhum vídeo fica pequeno demais para assistir, em qualquer combinação", () => {
    for (const pattern of allSequences(9)) {
      for (const row of buildGalleryRows(sequence(pattern))) {
        const { height, widths } = rowGeometry(row.units);
        row.units.forEach((unit, index) => {
          if (unit.kind === "stack") {
            // cada metade da pilha: ≥ 40% da largura da galeria (≈ 430px no desktop)
            expect(((height - LAYOUT.gap) / 2) * (16 / 9), pattern).toBeGreaterThanOrEqual(0.4);
          } else if (unit.video.orientation === "landscape") {
            expect(widths[index], pattern).toBeGreaterThanOrEqual(0.4);
          } else {
            // vertical: ≥ 45% da largura de altura (≈ 490px no desktop)
            expect(height, pattern).toBeGreaterThanOrEqual(0.45);
          }
        });
      }
    }
  });

  it("linha mista: o vertical não encolhe para o horizontal caber", () => {
    const [row] = buildGalleryRows(sequence("LP"));
    const { height, widths, fill } = rowGeometry(row.units);
    // vertical na altura confortável; o horizontal fica com o resto da largura, mais baixo
    expect(height).toBeCloseTo(LAYOUT.minPortraitHeight, 6);
    expect(widths[0] / (16 / 9)).toBeLessThan(height);
    expect(widths[0]).toBeGreaterThanOrEqual(LAYOUT.minLandscapeWidth);
    expect(fill).toBeCloseTo(1, 6);
    expect(row.columns.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 6);
  });

  it("nenhuma linha passa do teto de altura; linhas que não chegam nele ocupam a largura toda", () => {
    for (const pattern of allSequences(8)) {
      for (const row of buildGalleryRows(sequence(pattern))) {
        const { height, fill } = rowGeometry(row.units);
        expect(height).toBeLessThanOrEqual(LAYOUT.maxRowHeight);
        if (height < LAYOUT.maxRowHeight) expect(fill).toBeCloseTo(1, 6);
      }
    }
  });

  it("a proporção da linha (CSS --row-aspect) vem junto: largura das colunas ÷ altura", () => {
    const [justified] = buildGalleryRows(sequence("LL"));
    expect(justified.aspect).toBeCloseTo(2 * (16 / 9), 6);
    const [mixed] = buildGalleryRows(sequence("LP"));
    expect(mixed.aspect).toBeCloseTo((1 - LAYOUT.gap) / LAYOUT.minPortraitHeight, 6);
  });
});

describe("buildLeadRows (Home com vídeo principal)", () => {
  const lead = (pattern: string) => {
    const videos = sequence(pattern);
    return describeRows(buildLeadRows(videos, videos[0].id));
  };

  it("principal horizontal: sozinho na primeira linha, em qualquer combinação de secundários", () => {
    for (const rest of ["", "L", "P", "LL", "PP", "LPL", "PLLP"]) {
      const rows = lead(`L${rest}`).split(" | ");
      expect(rows[0], `L${rest}`).toBe("L");
      if (rest) expect(rows.length).toBeGreaterThan(1);
    }
  });

  it("principal horizontal: nenhuma linha de secundários fica tão alta quanto a dele", () => {
    for (const rest of ["L", "LL", "LLP", "LPL", "PP", "LLLL"]) {
      const videos = sequence(`L${rest}`);
      const [leadRow, ...others] = buildLeadRows(videos, videos[0].id);
      const leadHeight = rowGeometry(leadRow.units, leadRow.maxHeight).height;
      for (const row of others) {
        const withPortrait = row.units.some((unit) => unit.kind === "single" && unit.video.orientation === "portrait");
        // só horizontais: 60% da altura dele; com vertical, um pouco mais (o vertical é estreito)
        const ratio = withPortrait ? 0.8 : 0.6;
        expect(rowGeometry(row.units, row.maxHeight).height, `L${rest}`).toBeLessThanOrEqual(leadHeight * ratio + 1e-9);
      }
    }
  });

  it("principal horizontal: ocupa a largura inteira da galeria", () => {
    const videos = sequence("LLP");
    const [leadRow] = buildLeadRows(videos, videos[0].id);
    expect(leadRow.lead).toBe("landscape");
    expect(rowGeometry(leadRow.units, leadRow.maxHeight).fill).toBeCloseTo(1, 6);
  });

  it("principal vertical: sozinho na primeira linha, secundários abaixo (nunca ao lado)", () => {
    for (const rest of ["", "L", "P", "LL", "PP", "LLP", "PLLP"]) {
      const pattern = `P${rest}`;
      const rows = lead(pattern).split(" | ");
      expect(rows[0], pattern).toBe("P");
      if (rest) expect(rows.length, pattern).toBeGreaterThan(1);
    }
  });

  it("principal vertical: bem maior que qualquer secundário, na proporção 9:16", () => {
    for (const rest of ["L", "LL", "LLP", "PP", "PPPP"]) {
      const videos = sequence(`P${rest}`);
      const [leadRow, ...others] = buildLeadRows(videos, videos[0].id);
      expect(leadRow.lead).toBe("portrait");
      const leadHeight = rowGeometry(leadRow.units, leadRow.maxHeight).height;
      const leadArea = leadHeight * leadHeight * (9 / 16);
      for (const row of others) {
        const { height, widths } = rowGeometry(row.units, row.maxHeight);
        expect(height, `P${rest}`).toBeLessThanOrEqual(leadHeight * 0.6 + 1e-9);
        row.units.forEach((unit, index) => {
          const area =
            unit.kind === "stack"
              ? height * height * (16 / 9) * 0.25
              : unit.video.orientation === "landscape"
                ? (widths[index] * widths[index]) / (16 / 9)
                : height * height * (9 / 16);
          expect(area, `P${rest}`).toBeLessThan(leadArea);
        });
      }
    }
  });

  it("sem principal (ou id que não é o primeiro): galeria comum", () => {
    const videos = sequence("LLP");
    expect(describeRows(buildLeadRows(videos))).toBe(layout("LLP"));
    expect(describeRows(buildLeadRows(videos, videos[1].id))).toBe(layout("LLP"));
  });
});
