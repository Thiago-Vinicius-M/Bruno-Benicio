import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ScrollTrigger } from "@/animations/gsap";
import { Music } from "./Music";
import { MUSIC_TRACKS, SPOTIFY_ARTIST_URL } from "./musicTracks";

function iframes() {
  return document.querySelectorAll("iframe");
}

function trackButtons() {
  return screen.getAllByRole("button");
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/*
 * O jsdom não calcula layout: o ScrollTrigger nunca dispara e, com animação, os elementos
 * ficariam no estado inicial (ocultos). Os testes de comportamento rodam com reduced motion
 * — a seção fica na composição final, estática. A animação é testada no bloco seguinte.
 */
describe("Music — comportamento", () => {
  beforeEach(() => {
    window.__matchingQueries.add(REDUCED_MOTION);
  });

  it("renderiza título, uma música por botão e um único player", () => {
    render(<Music />);

    expect(screen.getByRole("heading", { level: 2, name: "MÚSICAS" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "MÚSICAS" }).id).toBe("musicas");

    const buttons = trackButtons();
    expect(buttons).toHaveLength(MUSIC_TRACKS.length);
    MUSIC_TRACKS.forEach((track, i) => expect(buttons[i].textContent).toContain(track.title));

    expect(iframes()).toHaveLength(1);
    expect(iframes()[0].getAttribute("src")).toContain(`/embed/track/${MUSIC_TRACKS[0].id}`);
  });

  it("a primeira música abre selecionada e os botões controlam o player", () => {
    render(<Music />);
    const buttons = trackButtons();

    expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false", "false", "false"]);
    const playerId = buttons[0].getAttribute("aria-controls")!;
    expect(document.getElementById(playerId)?.querySelector("iframe")).toBeTruthy();
  });

  it("selecionar outra música troca o player e anuncia a troca", () => {
    render(<Music />);
    fireEvent.click(trackButtons()[2]);

    const selected = MUSIC_TRACKS[2];
    expect(iframes()).toHaveLength(1);
    expect(iframes()[0].getAttribute("src")).toContain(`/embed/track/${selected.id}`);
    expect(iframes()[0].getAttribute("title")).toBe(`Player do Spotify: ${selected.title}`);
    expect(trackButtons().map((b) => b.getAttribute("aria-pressed"))).toEqual([
      "false",
      "false",
      "true",
      "false",
    ]);
    expect(document.querySelector("[aria-live]")!.textContent).toBe(`Música selecionada: ${selected.title}`);
  });

  it("CTA leva ao perfil oficial em nova aba, com aviso acessível", () => {
    render(<Music />);
    const cta = screen.getByRole("link", { name: /ouça mais no spotify/i });

    expect(cta.getAttribute("href")).toBe(SPOTIFY_ARTIST_URL);
    expect(cta.getAttribute("target")).toBe("_blank");
    expect(cta.getAttribute("rel")).toContain("noopener");
    expect(cta.textContent).toContain("abre em nova aba");
  });

  it("aceita outra lista de músicas sem alterar o componente", () => {
    render(<Music tracks={[{ id: "66aHceSvEnoETv7vWisfQq", title: "Amigo" }]} />);
    expect(trackButtons()).toHaveLength(1);
    expect(iframes()[0].getAttribute("src")).toContain("/embed/track/66aHceSvEnoETv7vWisfQq");
  });

  it("lista vazia não quebra: sem player e sem botões", () => {
    render(<Music tracks={[]} />);
    expect(iframes()).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "MÚSICAS" })).toBeTruthy();
  });
});

describe("Music — animação", () => {
  it("cria a animação de entrada e a remove ao desmontar", () => {
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    const { unmount } = render(<Music />);
    expect(ScrollTrigger.getAll()).toHaveLength(1);

    unmount();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(iframes()).toHaveLength(0);
  });

  it("todos os grupos (título, luz, player, lista, CTA) começam ocultos até a entrada", () => {
    render(<Music />);
    const groups = ["heading", "decor", "player", "tracks"];

    for (const name of groups) {
      const targets = document.querySelectorAll<HTMLElement>(`[data-reveal="${name}"]`);
      expect(targets.length, name).toBeGreaterThan(0);
      targets.forEach((el) => expect(el.style.visibility, name).toBe("hidden"));
    }
  });

  it("com prefers-reduced-motion não cria animação e o conteúdo fica visível", () => {
    window.__matchingQueries.add(REDUCED_MOTION);
    render(<Music />);

    expect(ScrollTrigger.getAll()).toHaveLength(0);
    for (const el of document.querySelectorAll<HTMLElement>("[data-reveal]")) {
      expect(el.style.opacity).toBe("");
      expect(el.style.visibility).toBe("");
    }
  });

  it("no celular não há animação de entrada: o conteúdo já aparece pronto", () => {
    window.__matchingQueries = new Set(["(max-width: 767px)"]);
    render(<Music />);

    expect(ScrollTrigger.getAll()).toHaveLength(0);
    for (const el of document.querySelectorAll<HTMLElement>("[data-reveal]")) {
      expect(el.style.visibility).toBe("");
    }
  });
});
