import { describe, expect, it } from "vitest";
import { buildGalleryRows } from "./galleryLayout";
import type { GalleryVideo, VideoOrientation } from "./types";

const video = (id: string, orientation: VideoOrientation): GalleryVideo => ({
  id,
  type: "video",
  sourceType: "local",
  orientation,
  title: id,
});

const L = (id: string) => video(id, "landscape");
const P = (id: string) => video(id, "portrait");

const ids = (rows: ReturnType<typeof buildGalleryRows>) =>
  rows.map((row) => [row.template, row.videos.map((v) => v.id)]);

describe("buildGalleryRows", () => {
  it("4 horizontais + 2 verticais formam pair + feature", () => {
    const rows = buildGalleryRows([L("h1"), L("h2"), P("v1"), L("h3"), L("h4"), P("v2")]);
    expect(ids(rows)).toEqual([
      ["pair", ["h1", "h2"]],
      ["feature", ["v1", "h3", "h4", "v2"]],
    ]);
  });

  it("cada orientação preenche suas posições na ordem da lista, independente da mistura", () => {
    const rows = buildGalleryRows([P("v1"), P("v2"), L("h1"), L("h2"), L("h3"), L("h4")]);
    expect(ids(rows)).toEqual([
      ["pair", ["h1", "h2"]],
      ["feature", ["v1", "h3", "h4", "v2"]],
    ]);
  });

  it("o padrão repete enquanto houver vídeos", () => {
    const rows = buildGalleryRows([
      ...["a", "b", "c", "d", "e", "f", "g", "h"].map(L),
      ...["v1", "v2", "v3", "v4"].map(P),
    ]);
    expect(rows.map((row) => row.template)).toEqual(["pair", "feature", "pair", "feature"]);
  });

  it("template sem vídeos suficientes é pulado; sobras vão para 'rest' na ordem original", () => {
    const rows = buildGalleryRows([L("h1"), P("v1"), L("h2"), L("h3"), P("v2")]);
    // pair usa h1,h2; feature precisa de 2 horizontais (só há h3); pair precisa de 2.
    expect(ids(rows)).toEqual([
      ["pair", ["h1", "h2"]],
      ["rest", ["v1", "h3", "v2"]],
    ]);
  });

  it("só horizontais: vários pairs, sem vazios", () => {
    expect(ids(buildGalleryRows(["a", "b", "c", "d", "e"].map(L)))).toEqual([
      ["pair", ["a", "b"]],
      ["pair", ["c", "d"]],
      ["rest", ["e"]],
    ]);
  });

  it("aceita outro padrão e lista vazia", () => {
    const rows = buildGalleryRows([P("v1"), L("h1"), L("h2"), P("v2")], ["feature"]);
    expect(ids(rows)).toEqual([["feature", ["v1", "h1", "h2", "v2"]]]);
    expect(buildGalleryRows([])).toEqual([]);
  });
});
