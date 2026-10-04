import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Header } from "./Header";
import { NAV_LINKS } from "./navLinks";

function menuButton() {
  return screen.getByRole("button", { name: /menu/i });
}

function drawer() {
  return document.getElementById(menuButton().getAttribute("aria-controls")!)!;
}

describe("Header", () => {
  it("a topbar e a gaveta têm as mesmas seções, sem Modelos nem Agenda", () => {
    render(<Header />);
    const labels = NAV_LINKS.map((link) => link.label);

    expect(labels).toEqual(["HOME", "SOBRE NÓS", "VIDEOS/MÚSICAS", "NOSSO SHOW", "CONTATO"]);
    expect(NAV_LINKS.some((link) => link.href === "#agenda")).toBe(false);
    for (const nav of document.querySelectorAll("nav")) {
      expect(within(nav).getAllByRole("link", { hidden: true }).map((a) => a.textContent).filter((t) => t)).toEqual(
        labels,
      );
    }
  });

  it("botão de menu abre e fecha a gaveta, com rótulo e aria-expanded", () => {
    render(<Header />);
    const button = menuButton();

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("Abrir menu");
    expect(drawer().tagName).toBe("NAV");

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("Fechar menu");

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("tocar numa seção fecha a gaveta e mantém a âncora da seção", () => {
    render(<Header />);
    fireEvent.click(menuButton());

    const link = within(drawer()).getByText("CONTATO");
    expect(link.getAttribute("href")).toBe("#contato");
    fireEvent.click(link);
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("fecha pelo overlay e com Esc (devolvendo o foco ao botão)", () => {
    render(<Header />);
    const button = menuButton();

    fireEvent.click(button);
    fireEvent.click(drawer().previousElementSibling!); // overlay
    expect(button.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("gaveta começa fechada (oculta) até ser aberta", () => {
    render(<Header />);
    expect(drawer().style.visibility).toBe("hidden");
  });
});
