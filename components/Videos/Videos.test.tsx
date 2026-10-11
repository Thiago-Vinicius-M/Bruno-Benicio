import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollTrigger } from "@/animations/gsap";
import { ExperienceProvider } from "@/components/Experience/ExperienceProvider";
import type { GalleryVideo } from "@/components/VideoGallery/types";
import type { VideoCollection } from "@/lib/videos/gallery";
import { Videos } from "./Videos";
import { VideosExperience } from "./VideosExperience";
import { VideosProvider } from "./videosContext";

const MOBILE = "(max-width: 767px)";

const video = (id: string, orientation: GalleryVideo["orientation"]): GalleryVideo => ({
  id,
  type: "video",
  sourceType: "youtube",
  orientation,
  title: id,
  source: "dQw4w9WgXcQ",
});

const COLLECTION: VideoCollection = {
  main: null,
  secondary: [video("destaque-1", "portrait"), video("destaque-2", "landscape")],
  galleryOnly: [video("galeria-1", "landscape")],
  limits: { desktop: 3, mobile: 3 },
};

function renderVideos(videos: VideoCollection = COLLECTION) {
  return render(
    <VideosProvider videos={videos}>
      <ExperienceProvider>
        <Videos />
      </ExperienceProvider>
    </VideosProvider>,
  );
}

const moreBlock = () => screen.queryByRole("link", { name: /Ver mais/ })?.closest("div[class]") ?? null;
const homeTitles = (container: HTMLElement) =>
  [...container.querySelectorAll("#videos li h3")].map((h3) => h3.textContent);
const visibleOnMobile = (container: HTMLElement) =>
  [...container.querySelectorAll("#videos li")]
    .filter((li) => !li.hasAttribute("data-mobile-hidden") && !li.closest("ul")?.hasAttribute("data-mobile-hidden"))
    .map((li) => li.querySelector("h3")?.textContent);
const visibleOnDesktop = (container: HTMLElement) =>
  [...container.querySelectorAll("#videos li")]
    .filter((li) => !li.closest("ul")?.hasAttribute("data-desktop-hidden"))
    .map((li) => li.querySelector("h3")?.textContent);

describe("Videos — conteúdo", () => {
  it("a Home mostra principal e secundários (não os “só Ver mais”), e o “Ver mais” porque há galeria", () => {
    const { container } = renderVideos();
    expect(homeTitles(container)).toEqual(["destaque-1", "destaque-2"]);
    expect(moreBlock()).toBeTruthy();
  });

  it("nada para o “Ver mais”: sem botão", () => {
    renderVideos({ ...COLLECTION, galleryOnly: [] });
    expect(moreBlock()).toBeNull();
  });

  it("sem vídeos ativos (banco vazio ou fora do ar), a seção não aparece", () => {
    const { container } = renderVideos({ ...COLLECTION, secondary: [], galleryOnly: [] });
    expect(container.querySelector("#videos")).toBeNull();
  });

  it("só vídeos “só Ver mais”: a seção continua, com o botão", () => {
    renderVideos({ ...COLLECTION, secondary: [] });
    expect(moreBlock()).toBeTruthy();
  });

  it("principal sempre primeiro, contando no limite", () => {
    const { container } = renderVideos({
      ...COLLECTION,
      main: video("principal", "portrait"),
      limits: { desktop: 2, mobile: 2 },
    });
    expect(homeTitles(container)).toEqual(["principal", "destaque-1"]);
  });
});

describe("Videos — limites por dispositivo (mesmo HTML, CSS decide)", () => {
  const many: VideoCollection = {
    main: video("principal", "landscape"),
    secondary: ["s1", "s2", "s3", "s4"].map((id) => video(id, "landscape")),
    galleryOnly: [],
    limits: { desktop: 4, mobile: 2 },
  };

  it("desktop 4 / celular 2: o celular esconde o 3º e o 4º", () => {
    const { container } = renderVideos(many);
    expect(visibleOnDesktop(container)).toEqual(["principal", "s1", "s2", "s3"]);
    expect(visibleOnMobile(container)).toEqual(["principal", "s1"]);
    // “Ver mais” nos dois (s4 sobra no desktop).
    const more = moreBlock()!;
    expect(more.hasAttribute("data-hide-desktop")).toBe(false);
    expect(more.hasAttribute("data-hide-mobile")).toBe(false);
  });

  it("celular com limite maior que o desktop: os extras ficam numa linha só do celular", () => {
    const { container } = renderVideos({ ...many, limits: { desktop: 1, mobile: 3 } });
    expect(visibleOnDesktop(container)).toEqual(["principal"]);
    expect(visibleOnMobile(container)).toEqual(["principal", "s1", "s2"]);
  });

  it("tudo cabe no desktop mas não no celular: “Ver mais” só no celular", () => {
    renderVideos({ ...many, limits: { desktop: 5, mobile: 2 } });
    const more = moreBlock()!;
    expect(more.hasAttribute("data-hide-desktop")).toBe(true);
    expect(more.hasAttribute("data-hide-mobile")).toBe(false);
  });

  it("principal (horizontal ou vertical) ganha linha própria; secundários vêm abaixo", () => {
    const { container } = renderVideos(many);
    const firstRow = container.querySelector("#videos ul")!;
    expect([...firstRow.querySelectorAll("h3")].map((h3) => h3.textContent)).toEqual(["principal"]);
    expect(firstRow.getAttribute("data-lead")).toBe("landscape");

    const portrait = renderVideos({
      ...many,
      main: video("vertical", "portrait"),
      secondary: [video("h1", "landscape"), video("h2", "landscape")],
    });
    const [row, ...others] = portrait.container.querySelectorAll("#videos ul");
    expect(row.getAttribute("data-lead")).toBe("portrait");
    expect([...row.querySelectorAll("h3")].map((h3) => h3.textContent)).toEqual(["vertical"]);
    expect(others.length).toBeGreaterThan(0);
    expect(others.every((other) => !other.hasAttribute("data-lead"))).toBe(true);
  });

  it("sem principal: nenhuma linha de destaque", () => {
    const { container } = renderVideos({ ...many, main: null });
    expect(container.querySelector("#videos ul[data-lead]")).toBeNull();
  });
});

describe("“Ver mais” (subtela)", () => {
  const many: VideoCollection = {
    main: video("principal", "landscape"),
    secondary: ["s1", "s2", "s3"].map((id) => video(id, "landscape")),
    galleryOnly: [video("g1", "portrait")],
    limits: { desktop: 3, mobile: 1 },
  };
  const titles = () => [...document.querySelectorAll("li h3")].map((h3) => h3.textContent);

  it("desktop: o que passou do limite do desktop + os exclusivos, sem repetir a Home", () => {
    render(
      <VideosProvider videos={many}>
        <VideosExperience />
      </VideosProvider>,
    );
    expect(titles()).toEqual(["s3", "g1"]);
  });

  it("celular: usa o limite do celular", () => {
    window.__matchingQueries = new Set([MOBILE]);
    render(
      <VideosProvider videos={many}>
        <VideosExperience />
      </VideosProvider>,
    );
    expect(titles()).toEqual(["s1", "s2", "s3", "g1"]);
  });
});

describe("Videos — entrada", () => {
  it("desktop: mantém a timeline cinematic com pin", () => {
    renderVideos();
    expect(ScrollTrigger.getAll().some((trigger) => trigger.pin)).toBe(true);
  });

  it("celular: sem animação de entrada nem pin — frase, título e vídeos já no lugar", () => {
    window.__matchingQueries = new Set([MOBILE]);
    renderVideos();

    expect(ScrollTrigger.getAll()).toHaveLength(0);
    for (const el of document.querySelectorAll<HTMLElement>("#videos p, #videos h2, #videos ul")) {
      expect(el.style.visibility).toBe("");
      expect(el.style.transform).toBe("");
    }
  });

  it("desmontar remove a timeline (sem gatilhos órfãos)", () => {
    const { unmount } = renderVideos();
    expect(ScrollTrigger.getAll().length).toBeGreaterThan(0);
    unmount();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });
});
