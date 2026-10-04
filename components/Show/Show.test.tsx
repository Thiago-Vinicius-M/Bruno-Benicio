import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollTrigger } from "@/animations/gsap";
import { formatPrice } from "./showContent";
import { Show } from "./Show";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

describe("Show (NOSSO SHOW)", () => {
  it("formatos com duração e preço do orçamento", () => {
    window.__matchingQueries.add(REDUCED_MOTION);
    render(<Show />);
    const list = screen.getByRole("list", { name: "Formatos de show" });
    const rows = within(list).getAllByRole("listitem").map((li) => li.textContent?.replace(/\s/g, " "));

    expect(rows).toEqual([
      `Voz e violão2h30 de show${formatPrice(1500)}`,
      `Voz, violão e bateria2h30 de show${formatPrice(1800)}`,
      `Voz, violão, sanfona e bateria2h30 de show${formatPrice(2200)}`,
      `Bruno e Benício e banda2h30 de show${formatPrice(3000)}`,
    ].map((row) => row.replace(/\s/g, " ")));
    expect(formatPrice(1500).replace(/\s/g, " ")).toBe("R$ 1.500,00");
  });

  it("repertório e estrutura; o contato fica na seção CONTATO", () => {
    window.__matchingQueries.add(REDUCED_MOTION);
    render(<Show />);

    expect(screen.getByText("Sertanejo, modão, MPB, pagode, pop rock e forró.")).toBeTruthy();
    expect(screen.getByText("Estrutura de som e iluminação")).toBeTruthy();
    expect(screen.queryByText(/Contrate agora/)).toBeNull();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("cria a entrada (desktop e celular) e a remove ao desmontar", () => {
    const { unmount } = render(<Show />);
    expect(ScrollTrigger.getAll()).toHaveLength(1);
    unmount();

    window.__matchingQueries = new Set(["(max-width: 767px)"]);
    render(<Show />);
    expect(ScrollTrigger.getAll()).toHaveLength(1);
  });
});
