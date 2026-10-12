import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Agenda } from "./Agenda";

// next/font só funciona com o compilador do Next.
vi.mock("next/font/google", () => {
  const font = () => ({ className: "", variable: "", style: { fontFamily: "" } });
  return { Montserrat: font };
});

const show = (id: string, show_date: string, show_time: string, venue_name: string) => ({
  id,
  show_date,
  show_time,
  venue_name,
  venue_instagram: null as string | null,
});

/** "Agora" em São Paulo (UTC-3). */
const saoPaulo = (dateTime: string) => new Date(`${dateTime}-03:00`);
const NOW = { date: "2026-10-17", time: "15:00" };

/** n shows a partir de 17/10, um por dia (todos em outubro para n ≤ 15). */
const many = (n: number) =>
  Array.from({ length: n }, (_, i) => show(String(i + 1), `2026-10-${String(17 + i).padStart(2, "0")}`, "20:00:00", `Casa ${i + 1}`));

beforeEach(() => {
  // Composição final, sem animação (o jsdom não calcula layout para o ScrollTrigger).
  window.__matchingQueries.add("(prefers-reduced-motion: reduce)");
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(saoPaulo("2026-10-17T15:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

/** Locais da página visível. */
const visibleVenues = () =>
  screen.getAllByRole("list").flatMap((list) =>
    list.getAttribute("aria-hidden") ? [] : [...list.querySelectorAll("li p")].map((p) => p.textContent),
  );

describe("Agenda", () => {
  it("cada show vira uma linha: dia da semana + data, local e horário", () => {
    render(
      <Agenda
        now={NOW}
        shows={[show("1", "2026-10-17", "20:00:00", "Bar do Fulano"), show("2", "2026-10-18", "12:30:00", "Bar do Ciclano")]}
      />,
    );

    const section = screen.getByRole("region", { name: "AGENDA" });
    expect(section.id).toBe("agenda");
    const rows = within(section).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual(["sáb17/10Bar do Fulano20:00", "dom18/10Bar do Ciclano12:30"]);
    expect(rows[0].querySelector("time")?.getAttribute("dateTime")).toBe("2026-10-17");
    // Até 7 shows: sem carrossel.
    expect(screen.queryByRole("region", { name: "Próximos shows" })).toBeNull();
  });

  it("só o mês atual e só o que ainda vai acontecer (shows de hoje que já passaram saem)", () => {
    render(
      <Agenda
        now={NOW}
        shows={[
          show("1", "2026-10-17", "12:00:00", "Já passou"),
          show("2", "2026-10-17", "22:00:00", "Hoje à noite"),
          show("3", "2026-10-31", "20:00:00", "Fim do mês"),
          show("4", "2026-11-01", "20:00:00", "Próximo mês"),
        ]}
      />,
    );
    expect(visibleVenues()).toEqual(["Hoje à noite", "Fim do mês"]);
  });

  it("a lista acompanha o relógio sem regenerar a página (virada do mês esvazia outubro)", () => {
    render(<Agenda now={NOW} shows={[show("1", "2026-10-17", "20:00:00", "Hoje"), show("2", "2026-10-31", "20:00:00", "Fim")]} />);
    expect(visibleVenues()).toEqual(["Hoje", "Fim"]);

    act(() => {
      vi.setSystemTime(saoPaulo("2026-10-17T20:01:00"));
      vi.advanceTimersByTime(60_000);
    });
    expect(visibleVenues()).toEqual(["Fim"]);

    act(() => {
      vi.setSystemTime(saoPaulo("2026-11-01T00:01:00"));
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("Em breve, novas datas.")).toBeTruthy();
    expect(screen.getByText("Novembro 2026")).toBeTruthy();
  });

  it("mês e ano atuais abaixo do título", () => {
    render(<Agenda now={NOW} shows={[]} />);
    expect(screen.getByRole("heading", { name: "AGENDA" }).nextElementSibling?.textContent).toBe("Outubro 2026");
  });

  it("mais de 7 shows: páginas de 7, trocadas pelas bolinhas, arrastando ou com ← →", () => {
    render(<Agenda now={NOW} shows={many(10)} />);

    const carousel = screen.getByRole("region", { name: "Próximos shows" });
    expect(visibleVenues()).toEqual(["Casa 1", "Casa 2", "Casa 3", "Casa 4", "Casa 5", "Casa 6", "Casa 7"]);
    const dots = within(carousel).getAllByRole("button", { name: /^Shows \d/ });
    expect(dots.map((dot) => dot.getAttribute("aria-label"))).toEqual(["Shows 1 a 7 de 10", "Shows 8 a 10 de 10"]);

    fireEvent.click(dots[1]);
    expect(visibleVenues()).toEqual(["Casa 8", "Casa 9", "Casa 10"]);

    // Arrastar para a direita volta; arraste curto ou vertical não troca.
    const pages = carousel.firstElementChild!;
    fireEvent.pointerDown(pages, { pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerUp(pages, { pointerType: "touch", clientX: 120, clientY: 100 });
    expect(visibleVenues()[0]).toBe("Casa 8");
    fireEvent.pointerDown(pages, { pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerUp(pages, { pointerType: "touch", clientX: 200, clientY: 110 });
    expect(visibleVenues()[0]).toBe("Casa 1");

    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    expect(visibleVenues()[0]).toBe("Casa 8");
    expect(document.activeElement).toBe(dots[1]);
  });

  it("setas ‹ › trocam de página e ficam desativadas nas pontas; arrastar com o mouse também troca", () => {
    render(<Agenda now={NOW} shows={many(10)} />);
    const prev = screen.getByRole("button", { name: "Shows anteriores" }) as HTMLButtonElement;
    const next = screen.getByRole("button", { name: "Próximos shows" }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);

    fireEvent.click(next);
    expect(visibleVenues()[0]).toBe("Casa 8");
    expect(next.disabled).toBe(true);
    expect(prev.disabled).toBe(false);

    fireEvent.click(prev);
    expect(visibleVenues()[0]).toBe("Casa 1");

    const pages = screen.getByRole("region", { name: "Próximos shows" }).firstElementChild as HTMLElement;
    pages.setPointerCapture = () => {};
    fireEvent.pointerDown(pages, { pointerType: "mouse", button: 0, clientX: 300, clientY: 100 });
    fireEvent.pointerUp(pages, { pointerType: "mouse", button: 0, clientX: 200, clientY: 100 });
    expect(visibleVenues()[0]).toBe("Casa 8");
  });

  it("Instagram da casa abaixo do nome, só quando o show tem", () => {
    render(
      <Agenda now={NOW} shows={[{ ...show("1", "2026-10-17", "20:00:00", "Bar do Fulano"), venue_instagram: "bardofulano" }]} />,
    );
    const link = screen.getByRole("link", { name: "@bardofulano" });
    expect(link.getAttribute("href")).toBe("https://www.instagram.com/bardofulano/");
    expect(link.previousElementSibling?.textContent).toBe("Bar do Fulano");
  });

  it("sem shows no resto do mês mostra um aviso no lugar da lista", () => {
    render(<Agenda now={NOW} shows={[]} />);
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText("Em breve, novas datas.")).toBeTruthy();
  });
});
