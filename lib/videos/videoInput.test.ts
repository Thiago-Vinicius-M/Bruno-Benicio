import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "@/lib/agenda/testing/fakeSupabase";
import { parseVideoInput, updateVideoHomeLimitsFromInput } from "@/lib/painel/videos";
import type { VideoInput } from "./types";
import { normalizeMediaPath, suggestedYouTubeOrientation, toVideoRow } from "./videoInput";
import { createVideo, setVideoPlacement, updateVideo } from "./videosRepository";

const youtube: VideoInput = {
  title: "  Foi Deus  ",
  sourceType: "youtube",
  youtube: "https://www.youtube.com/watch?v=TDqHMUM0Z4k&t=10s",
  orientation: "landscape",
  placement: "secondary",
};

const local: VideoInput = {
  title: "Ela é demais",
  sourceType: "local",
  file: "public/videos/Ela e demais.mp4",
  poster: "videos/Ela e demaisTHUMB.jpg",
  orientation: "portrait",
  placement: "gallery",
};

const ok = (data: unknown) => ({ data, error: null });

describe("normalizeMediaPath", () => {
  it("caminho do projeto → src do site, codificado uma vez só", () => {
    expect(normalizeMediaPath("public/videos/Só Você.mp4")).toBe("/videos/S%C3%B3%20Voc%C3%AA.mp4");
    expect(normalizeMediaPath("/videos/S%C3%B3%20Voc%C3%AA.mp4")).toBe("/videos/S%C3%B3%20Voc%C3%AA.mp4");
    expect(normalizeMediaPath("videos\\capa.jpg")).toBe("/videos/capa.jpg");
  });

  it("vazio → null; http, outros esquemas e '..' → inválido", () => {
    expect(normalizeMediaPath("   ")).toBeNull();
    expect(normalizeMediaPath(undefined)).toBeNull();
    expect(normalizeMediaPath("http://site.com/a.mp4")).toBeUndefined();
    expect(normalizeMediaPath("javascript:alert(1)")).toBeUndefined();
    expect(normalizeMediaPath("/videos/../segredo.mp4")).toBeUndefined();
    expect(normalizeMediaPath("https://x.supabase.co/a b.mp4")).toBe("https://x.supabase.co/a%20b.mp4");
  });
});

describe("toVideoRow", () => {
  it("YouTube: guarda só o ID; título aparado; classificação preservada", () => {
    expect(toVideoRow(youtube)).toEqual({
      title: "Foi Deus",
      source_type: "youtube",
      source: "TDqHMUM0Z4k",
      poster: null,
      orientation: "landscape",
      placement: "secondary",
    });
  });

  it("arquivo: caminho e capa normalizados", () => {
    expect(toVideoRow(local)).toMatchObject({
      source: "/videos/Ela%20e%20demais.mp4",
      poster: "/videos/Ela%20e%20demaisTHUMB.jpg",
      placement: "gallery",
    });
  });

  it("orientação e classificação são independentes (vertical pode ser principal, horizontal só no Ver mais)", () => {
    expect(toVideoRow({ ...local, placement: "main" })).toMatchObject({ orientation: "portrait", placement: "main" });
    expect(toVideoRow({ ...youtube, placement: "gallery" })).toMatchObject({
      orientation: "landscape",
      placement: "gallery",
    });
  });

  it("recusa o que o banco recusaria, com mensagem para o usuário", () => {
    expect(() => toVideoRow({ ...youtube, title: " " })).toThrow("Informe o título");
    expect(() => toVideoRow({ ...youtube, youtube: "https://vimeo.com/1" })).toThrow("Link do YouTube inválido");
    expect(() => toVideoRow({ ...local, file: "" })).toThrow("Envie o arquivo .mp4");
    expect(() => toVideoRow({ ...local, file: "/videos/clip.mov" })).toThrow("terminado em .mp4");
    expect(() => toVideoRow({ ...local, poster: "/videos/capa.pdf" })).toThrow("Imagem de capa inválida");
    expect(() => toVideoRow({ ...local, orientation: "square" as never })).toThrow("formato");
    expect(() => toVideoRow({ ...local, placement: "featured" as never })).toThrow("principal, secundário");
  });

  it("Shorts sugerem vertical", () => {
    expect(suggestedYouTubeOrientation("https://youtube.com/shorts/abcdefghijk")).toBe("portrait");
    expect(suggestedYouTubeOrientation("https://youtu.be/abcdefghijk")).toBe("landscape");
  });
});

describe("parseVideoInput", () => {
  it("só os campos do formulário; o resto (posição, autoria, ativo) é descartado", () => {
    const parsed = parseVideoInput({ ...local, active: false, position: 1, created_by: "x" });
    expect(parsed).not.toHaveProperty("position");
    expect(parsed).not.toHaveProperty("created_by");
    expect(parsed).not.toHaveProperty("active");
    expect(parsed.placement).toBe("gallery");
  });
});

describe("repositório: vídeo principal", () => {
  const ID = "11111111-1111-4111-8111-111111111111";

  it("cadastro como principal: entra como secundário e é promovido por set_main_video (troca atômica)", async () => {
    const { client, calls } = createFakeSupabase([ok({ id: ID }), ok(null), ok({ id: ID, placement: "main" })]);
    await createVideo(client, { ...youtube, placement: "main" });
    expect(calls.find(([method]) => method === "insert")?.[1]).toMatchObject({ placement: "secondary" });
    expect(calls).toContainEqual(["rpc", "set_main_video", { p_id: ID }]);
  });

  it("cadastro como secundário ou “Ver mais”: sem set_main_video", async () => {
    const { client, calls } = createFakeSupabase([ok({ id: ID })]);
    await createVideo(client, local);
    expect(calls.find(([method]) => method === "insert")?.[1]).toMatchObject({ placement: "gallery" });
    expect(calls.some(([method]) => method === "rpc")).toBe(false);
  });

  it("edição promovendo a principal: grava os campos sem mexer na classificação e então promove", async () => {
    const { client, calls } = createFakeSupabase([
      ok({ id: ID, placement: "secondary" }),
      ok({ id: ID }),
      ok(null),
      ok({ id: ID, placement: "main" }),
    ]);
    await updateVideo(client, ID, { ...youtube, placement: "main" });
    expect(calls.find(([method]) => method === "update")?.[1]).not.toHaveProperty("placement");
    expect(calls).toContainEqual(["rpc", "set_main_video", { p_id: ID }]);
  });

  it("trocar a classificação para principal usa set_main_video; as outras são update simples", async () => {
    const promote = createFakeSupabase([ok(null), ok({ id: ID })]);
    await setVideoPlacement(promote.client, ID, "main");
    expect(promote.calls[0]).toEqual(["rpc", "set_main_video", { p_id: ID }]);

    const demote = createFakeSupabase([ok({ id: ID })]);
    await setVideoPlacement(demote.client, ID, "gallery");
    expect(demote.calls.find(([method]) => method === "update")?.[1]).toEqual({ placement: "gallery" });
  });
});

describe("limites da Home (painel)", () => {
  it("aceita inteiros de 1 a 12, independentes para desktop e celular", async () => {
    const { client, calls } = createFakeSupabase([ok({ home_limit_desktop: 6, home_limit_mobile: 2 })]);
    expect(await updateVideoHomeLimitsFromInput(client, { desktop: 6, mobile: "2" })).toMatchObject({
      status: "success",
    });
    expect(calls.find(([method]) => method === "update")?.[1]).toEqual({ home_limit_desktop: 6, home_limit_mobile: 2 });
  });

  it("recusa fora da faixa, fracionário ou texto — sem chegar ao banco", async () => {
    for (const input of [
      { desktop: 0, mobile: 3 },
      { desktop: 13, mobile: 3 },
      { desktop: 3, mobile: 2.5 },
      { desktop: "seis", mobile: 3 },
      { desktop: 3 },
      null,
    ]) {
      const { client, calls } = createFakeSupabase();
      expect(await updateVideoHomeLimitsFromInput(client, input), JSON.stringify(input)).toMatchObject({
        status: "error",
      });
      expect(calls).toHaveLength(0);
    }
  });
});
