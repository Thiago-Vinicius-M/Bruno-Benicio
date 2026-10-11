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
  it("monta as linhas na ordem da lista, com colunas proporcionais ao formato de cada card", () => {
    const { container } = render(<VideoGallery videos={VIDEOS} />);
    const rows = [...container.querySelectorAll<HTMLElement>("ul")];

    // H H · V H · H V
    expect(rows.map((row) => [...row.children].map((li) => li.getAttribute("data-orientation")))).toEqual([
      ["landscape", "landscape"],
      ["portrait", "landscape"],
      ["landscape", "portrait"],
    ]);
    expect(rows[1].style.getPropertyValue("--row-columns")).toBe("0.5625fr 1.7778fr");
    expect(rows[1].style.getPropertyValue("--row-aspect")).toBe("2.3403");
    expect(rows[1].style.getPropertyValue("--row-gaps")).toBe("1");
    expect([...rows[1].children].map((li) => (li as HTMLElement).style.getPropertyValue("--col"))).toEqual(["1", "2"]);
  });

  it("pilha: dois horizontais na mesma coluna, um em cima do outro; os outros ocupam as duas linhas", () => {
    const [h1, h2, v1, , , v2] = VIDEOS;
    const { container } = render(<VideoGallery videos={[h1, h2, v1, v2]} />);
    const row = container.querySelector<HTMLElement>("ul")!;
    const cells = [...row.children].map((li) => {
      const style = (li as HTMLElement).style;
      return [li.hasAttribute("data-stacked"), style.getPropertyValue("--col"), style.getPropertyValue("--row")];
    });

    expect(row.hasAttribute("data-stacked")).toBe(true);
    expect(cells).toEqual([
      [true, "1", "1"],
      [true, "1", "2"],
      [false, "2", "1 / span 2"],
      [false, "3", "1 / span 2"],
    ]);
  });

  it("thumbnail com `sizes` da largura real do card na linha", () => {
    render(<VideoGallery videos={VIDEOS} />);
    const img = screen.getByRole("button", { name: "Reproduzir vídeo: Foi Deus" }).closest("li")!.querySelector("img")!;
    expect(img.getAttribute("sizes")).toBe("(max-width: 767px) 100vw, (max-width: 1140px) 49vw, 530px");
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

  it("com onPlay o play é delegado (modal/lightbox) e o card não toca", () => {
    const played: string[] = [];
    const { container } = render(<VideoGallery videos={VIDEOS} onPlay={(video) => played.push(video.id)} />);
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir vídeo: Foi Deus" }));

    expect(played).toEqual(["h1"]);
    expect(players(container)).toHaveLength(0);
  });
});
