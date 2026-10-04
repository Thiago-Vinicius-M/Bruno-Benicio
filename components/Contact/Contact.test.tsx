import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollTrigger } from "@/animations/gsap";
import { Contact } from "./Contact";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const MESSAGE = encodeURIComponent("Olá! Gostaria de mais informações sobre o show");

describe("Contact (CONTATO)", () => {
  it("só o 'Contrate agora!', telefones e Instagram — sem os contatos de exemplo", () => {
    window.__matchingQueries.add(REDUCED_MOTION);
    const { container } = render(<Contact />);

    expect(container.querySelector("#contato")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Contrate agora!");
    expect(screen.queryByText(/Contato \d/)).toBeNull();
  });

  it("cada telefone abre o WhatsApp com a mensagem pronta, em nova aba", () => {
    window.__matchingQueries.add(REDUCED_MOTION);
    render(<Contact />);
    const links = within(screen.getByRole("list", { name: "WhatsApp para contratar" })).getAllByRole("link");

    expect(links.map((a) => [a.textContent?.replace(" (WhatsApp, abre em nova aba)", ""), a.getAttribute("href")])).toEqual([
      ["(62) 99224-6887", `https://wa.me/5562992246887?text=${MESSAGE}`],
      ["(62) 99100-3836", `https://wa.me/5562991003836?text=${MESSAGE}`],
    ]);
    for (const a of links) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
    }
    expect(screen.getByRole("link", { name: /@brunoebeniciobb/ }).getAttribute("href")).toBe(
      "https://www.instagram.com/brunoebeniciobb/",
    );
  });

  it("cria a entrada e a remove ao desmontar", () => {
    const { unmount } = render(<Contact />);
    expect(ScrollTrigger.getAll()).toHaveLength(1);
    unmount();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });
});
