import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import type { GalleryVideo } from "./types";
import { VideoGallery } from "./VideoGallery";

const YT_ID = "dQw4w9WgXcQ";

const VIDEOS: GalleryVideo[] = [
  { id: "h1", type: "video", sourceType: "youtube", orientation: "landscape", title: "Foi Deus", source: `https://youtu.be/${YT_ID}` },
  { id: "h2", type: "video", sourceType: "youtube", orientation: "landscape", title: "Amigo", category: "Clipe" },
  { id: "v1", type: "video", sourceType: "local", orientation: "portrait", title: "Bastidores", source: "/videos/bastidores.mp4", thumbnail: "/videos/bastidores.jpg" },
  { id: "h3", type: "video", sourceType: "youtube", orientation: "landscape", title: "Link quebrado", source: "https://example.com/x" },
  { id: "h4", type: "video", sourceType: "instagram", orientation: "landscape", title: "Insta", source: "https://instagram.com/p/x" },
  { id: "v2", type: "video", sourceType: "local", orientation: "portrait", title: "Sem poster", source: "/videos/sem-poster.mp4" },
];

/** Players de verdade (vídeo com controles ou iframe) — não conta a prévia do primeiro quadro. */
const players = (root: HTMLElement) => root.querySelectorAll("video[controls], iframe");

beforeAll(() => {
  // jsdom não implementa mídia
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => {};
});

describe("VideoGallery", () => {
  it("monta as linhas com orientação e posição de cada card", () => {
    const { container } = render(<VideoGallery videos={VIDEOS} />);
    const rows = container.querySelectorAll("[data-template]");

    expect([...rows].map((row) => row.getAttribute("data-template"))).toEqual(["pair", "feature"]);
    const feature = [...rows[1].children].map((li) => [li.getAttribute("data-slot"), li.getAttribute("data-orientation")]);
    expect(feature).toEqual([
      ["0", "portrait"],
      ["1", "landscape"],
      ["2", "landscape"],
      ["3", "portrait"],
    ]);
  });

  it("nenhum player é carregado antes do play", () => {
    const { container } = render(<VideoGallery videos={VIDEOS} />);
    expect(players(container)).toHaveLength(0);
  });

  it("play acessível; sem link, link inválido ou fonte sem player, o card fica 'em breve'", () => {
    render(<VideoGallery videos={VIDEOS} />);

    expect(screen.getByRole("button", { name: "Reproduzir vídeo: Foi Deus" }).getAttribute("aria-disabled")).toBe("false");
    expect(screen.getByRole("button", { name: "Vídeo em breve: Amigo" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Vídeo em breve: Link quebrado" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Vídeo em breve: Insta" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Amigo" })).toBeTruthy();
  });

  it("YouTube: thumbnail automática e player embutido no card depois do play", () => {
    const { container } = render(<VideoGallery videos={VIDEOS} />);
    const card = screen.getByRole("button", { name: "Reproduzir vídeo: Foi Deus" }).closest("li")!;
    expect(card.querySelector("img")!.getAttribute("src")).toContain(encodeURIComponent(`i.ytimg.com/vi/${YT_ID}/`));

    fireEvent.click(screen.getByRole("button", { name: "Reproduzir vídeo: Foi Deus" }));
    const iframe = container.querySelector("iframe")!;
    expect(iframe.getAttribute("src")).toBe(`https://www.youtube-nocookie.com/embed/${YT_ID}?autoplay=1&rel=0&playsinline=1`);
    expect(iframe.getAttribute("title")).toBe("Vídeo do YouTube: Foi Deus");
    expect(iframe.hasAttribute("allowfullscreen")).toBe(true);
  });

  it("mp4: toca no card com foco no vídeo; só um vídeo por vez", () => {
    const { container } = render(<VideoGallery videos={VIDEOS} />);

    fireEvent.click(screen.getByRole("button", { name: "Reproduzir vídeo: Foi Deus" }));
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir vídeo: Bastidores" }));

    expect(players(container)).toHaveLength(1);
    const video = container.querySelector("video[controls]")!;
    expect(video.getAttribute("src")).toBe("/videos/bastidores.mp4");
    expect(video.getAttribute("poster")).toBe("/videos/bastidores.jpg");
    expect(document.activeElement).toBe(video);
    expect(screen.getByRole("button", { name: "Reproduzir vídeo: Foi Deus" })).toBeTruthy();
  });

  it("mp4 sem poster mostra o primeiro quadro como thumbnail", () => {
    render(<VideoGallery videos={VIDEOS} />);
    const card = screen.getByRole("button", { name: "Reproduzir vídeo: Sem poster" }).closest("li")!;
    const preview = card.querySelector("video")!;

    expect(preview.getAttribute("src")).toBe("/videos/sem-poster.mp4#t=0.1");
    expect(preview.getAttribute("preload")).toBe("metadata");
    expect(preview.hasAttribute("controls")).toBe(false);
  });

  it("ao terminar, o card volta para a thumbnail", () => {
    const { container } = render(<VideoGallery videos={VIDEOS} />);
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir vídeo: Bastidores" }));
    fireEvent.ended(container.querySelector("video[controls]")!);
    expect(players(container)).toHaveLength(0);
  });

  it("highlights marca os destaques do celular com a ordem pedida; os outros ficam sem marca", () => {
    const { container } = render(<VideoGallery videos={VIDEOS} highlights={["v1", "h1", "h2"]} />);
    const gallery = container.firstElementChild as HTMLElement;
    const marked = [...container.querySelectorAll<HTMLElement>("[data-highlight]")].map((li) => [
      li.querySelector("h3")!.textContent,
      li.style.getPropertyValue("--highlight-order"),
    ]);

    expect(gallery.hasAttribute("data-highlights")).toBe(true);
    expect(marked).toEqual([
      ["Foi Deus", "1"],
      ["Amigo", "2"],
      ["Bastidores", "0"],
    ]);
    // todos continuam no DOM (tablet/desktop mostram a lista inteira)
    expect(container.querySelectorAll("li")).toHaveLength(VIDEOS.length);
  });

  it("completeRowsOnly marca a galeria (o CSS esconde a linha de sobras no tablet/desktop)", () => {
    const extra: GalleryVideo = { id: "v3", type: "video", sourceType: "local", orientation: "portrait", title: "Sobra" };
    const { container } = render(<VideoGallery videos={[...VIDEOS, extra]} completeRowsOnly />);
    const gallery = container.firstElementChild as HTMLElement;

    expect(gallery.hasAttribute("data-complete-rows")).toBe(true);
    expect([...gallery.children].map((row) => row.getAttribute("data-template"))).toEqual(["pair", "feature", "rest"]);
    expect(gallery.querySelector('[data-template="rest"]')!.textContent).toContain("Sobra");
  });

  it("sem highlights nenhum card é marcado", () => {
    const { container } = render(<VideoGallery videos={VIDEOS} />);
    expect((container.firstElementChild as HTMLElement).hasAttribute("data-highlights")).toBe(false);
    expect(container.querySelectorAll("[data-highlight]")).toHaveLength(0);
  });

  it("com onPlay o play é delegado (modal/lightbox) e o card não toca", () => {
    const played: string[] = [];
    const { container } = render(<VideoGallery videos={VIDEOS} onPlay={(video) => played.push(video.id)} />);
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir vídeo: Foi Deus" }));

    expect(played).toEqual(["h1"]);
    expect(players(container)).toHaveLength(0);
  });
});
