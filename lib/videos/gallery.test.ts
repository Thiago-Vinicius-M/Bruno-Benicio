import { describe, expect, it } from "vitest";
import { buildLeadRows } from "@/components/VideoGallery/galleryLayout";
import { DEFAULT_HOME_LIMITS, parseHomeLimit, splitHomeVideos, toVideoCollection } from "./gallery";
import type { PublicVideo, Video, VideoPlacement } from "./types";

type Orientation = PublicVideo["orientation"];

const row = (id: string, placement: VideoPlacement, orientation: Orientation = "landscape", active = true) =>
  ({
    id,
    title: id,
    source_type: "youtube",
    source: "abcdefghijk",
    poster: null,
    orientation,
    placement,
    active,
  }) as Video;

const ids = (list: { id: string }[]) => list.map((video) => video.id);

/** Todos os vídeos ativos aparecem exatamente uma vez entre Home e "Ver mais". */
function expectPartition(split: ReturnType<typeof splitHomeVideos>, activeIds: string[]) {
  const all = [...ids(split.home), ...ids(split.more)];
  expect(new Set(all).size).toBe(all.length);
  expect([...all].sort()).toEqual([...activeIds].sort());
}

const CATALOG = [
  row("s1", "secondary", "portrait"),
  row("g1", "gallery"),
  row("main", "main", "landscape"),
  row("s2", "secondary"),
  row("s3", "secondary", "portrait"),
  row("off", "secondary", "landscape", false),
  row("s4", "secondary"),
  row("g2", "gallery", "portrait"),
  row("g-off", "gallery", "portrait", false),
];
const ACTIVE = ["main", "s1", "s2", "s3", "s4", "g1", "g2"];

describe("toVideoCollection", () => {
  it("separa por classificação, mantendo a ordem do painel e tirando os inativos", () => {
    const collection = toVideoCollection(CATALOG, { desktop: 4, mobile: 2 });
    expect(collection.main?.id).toBe("main");
    expect(ids(collection.secondary)).toEqual(["s1", "s2", "s3", "s4"]);
    expect(ids(collection.galleryOnly)).toEqual(["g1", "g2"]);
    expect(collection.limits).toEqual({ desktop: 4, mobile: 2 });
  });

  it("principal inativo não é exibido e nada assume o lugar dele automaticamente", () => {
    const collection = toVideoCollection([row("main", "main", "portrait", false), row("s1", "secondary")]);
    expect(collection.main).toBeNull();
    expect(ids(splitHomeVideos(collection, 3).home)).toEqual(["s1"]);
  });

  it("sem limites no banco: o comportamento anterior (3 e 3)", () => {
    expect(toVideoCollection([]).limits).toEqual(DEFAULT_HOME_LIMITS);
    expect(DEFAULT_HOME_LIMITS).toEqual({ desktop: 3, mobile: 3 });
  });
});

describe("splitHomeVideos (Home × “Ver mais”)", () => {
  const collection = toVideoCollection(CATALOG, { desktop: 4, mobile: 2 });

  it("principal primeiro e contando no limite; secundários na ordem; excedentes e “só Ver mais” na galeria", () => {
    const desktop = splitHomeVideos(collection, 4);
    expect(ids(desktop.home)).toEqual(["main", "s1", "s2", "s3"]);
    expect(ids(desktop.more)).toEqual(["s4", "g1", "g2"]);
    expectPartition(desktop, ACTIVE);
  });

  it("limites diferentes por dispositivo, sobre o mesmo catálogo", () => {
    const mobile = splitHomeVideos(collection, 2);
    expect(ids(mobile.home)).toEqual(["main", "s1"]);
    expect(ids(mobile.more)).toEqual(["s2", "s3", "s4", "g1", "g2"]);
    expectPartition(mobile, ACTIVE);
  });

  it("limite 1: só o principal na Home; o resto no “Ver mais”", () => {
    const split = splitHomeVideos(collection, 1);
    expect(ids(split.home)).toEqual(["main"]);
    expectPartition(split, ACTIVE);
  });

  it("sem principal: os secundários ocupam as primeiras posições", () => {
    const withoutMain = toVideoCollection(CATALOG.filter((video) => video.placement !== "main"));
    expect(ids(splitHomeVideos(withoutMain, 2).home)).toEqual(["s1", "s2"]);
  });

  it("menos vídeos que o limite: todos na Home e “Ver mais” só com os exclusivos", () => {
    const small = toVideoCollection([row("main", "main"), row("s1", "secondary")]);
    const split = splitHomeVideos(small, 6);
    expect(ids(split.home)).toEqual(["main", "s1"]);
    expect(split.more).toEqual([]); // → sem botão “Ver mais”
  });

  it("“só Ver mais” nunca vai para a Home, mesmo com limite sobrando", () => {
    const onlyGallery = toVideoCollection([row("g1", "gallery"), row("g2", "gallery")]);
    const split = splitHomeVideos(onlyGallery, 12);
    expect(split.home).toEqual([]);
    expect(ids(split.more)).toEqual(["g1", "g2"]);
  });

  it("qualquer combinação de orientações: o limite conta vídeos, não formatos", () => {
    const portraits = toVideoCollection([
      row("main", "main", "portrait"),
      row("p1", "secondary", "portrait"),
      row("p2", "secondary", "portrait"),
      row("l1", "secondary", "landscape"),
    ]);
    expect(splitHomeVideos(portraits, 3).home.map((video) => video.orientation)).toEqual([
      "portrait",
      "portrait",
      "portrait",
    ]);
  });

  it("determinístico: a mesma entrada dá sempre o mesmo resultado", () => {
    expect(splitHomeVideos(collection, 3)).toEqual(splitHomeVideos(toVideoCollection(CATALOG, collection.limits), 3));
  });
});

describe("composição da Home conforme o principal", () => {
  const gallery = (rows: Video[]) => {
    const collection = toVideoCollection(rows);
    return { home: splitHomeVideos(collection, 6).home, leadId: collection.main?.id };
  };

  it("principal horizontal: linha própria, secundários abaixo", () => {
    const { home, leadId } = gallery([
      row("main", "main", "landscape"),
      row("s1", "secondary", "landscape"),
      row("s2", "secondary", "portrait"),
    ]);
    const rows = buildLeadRows(home, leadId);
    expect(rows[0].units).toEqual([{ kind: "single", video: home[0] }]);
    expect(rows.slice(1).flatMap((r) => r.units).length).toBeGreaterThan(0);
  });

  it("principal vertical: primeira coluna da composição, sem esticar (proporção 9:16)", () => {
    const { home, leadId } = gallery([
      row("main", "main", "portrait"),
      row("s1", "secondary", "landscape"),
      row("s2", "secondary", "landscape"),
    ]);
    const [first] = buildLeadRows(home, leadId);
    expect(first.units[0]).toEqual({ kind: "single", video: home[0] });
    expect(home[0].orientation).toBe("portrait");
  });

  it("sem principal: galeria comum (nenhuma linha reservada)", () => {
    const { home, leadId } = gallery([row("s1", "secondary"), row("s2", "secondary")]);
    expect(leadId).toBeUndefined();
    expect(buildLeadRows(home, leadId).flatMap((r) => r.units).length).toBeGreaterThan(0);
  });
});

describe("parseHomeLimit", () => {
  it("inteiros de 1 a 12", () => {
    expect(parseHomeLimit(1)).toBe(1);
    expect(parseHomeLimit("12")).toBe(12);
    for (const raw of [0, 13, 2.5, "", " ", "abc", null, undefined, Number.NaN]) {
      expect(parseHomeLimit(raw), String(raw)).toBeNull();
    }
  });
});
