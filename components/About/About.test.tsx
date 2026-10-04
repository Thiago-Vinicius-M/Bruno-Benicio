import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { About } from "./About";
import { ABOUT_SLIDES } from "./aboutContent";

const dots = () => screen.getAllByRole("button", { name: /^Descrição:/ });
const activeText = () => document.querySelector("[aria-live] > [data-active]")!.textContent;
const current = () => dots().map((dot) => (dot.hasAttribute("aria-current") ? "*" : "o")).join(" ");

/** Arraste horizontal (dedo) de `dx` px. */
function swipe(dx: number, dy = 0) {
  const slider = document.querySelector("[aria-live]")!.parentElement!;
  fireEvent.pointerDown(slider, { pointerType: "touch", clientX: 200, clientY: 300 });
  fireEvent.pointerUp(slider, { pointerType: "touch", clientX: 200 + dx, clientY: 300 + dy });
}

describe("About — carrossel", () => {
  it("3 slides com os textos existentes: dupla, Bruno, Benício", () => {
    expect(ABOUT_SLIDES.map((slide) => slide.name)).toEqual(["Bruno e Benício", "Bruno", "Benício"]);
    expect(ABOUT_SLIDES[0].text).toContain("Nossa paixão pela música");
  });

  it("começa na dupla, com o indicador * o o", () => {
    render(<About />);
    expect(activeText()).toContain("Nossa paixão pela música");
    expect(current()).toBe("* o o");
  });

  it("arrastar para a esquerda avança, para a direita volta; para nas pontas", () => {
    render(<About />);
    swipe(-80);
    expect(activeText()).toContain("Bruno (Descrição)");
    expect(current()).toBe("o * o");

    swipe(-80);
    expect(current()).toBe("o o *");
    expect(activeText()).toContain("Benício (Descrição)");

    swipe(-80);
    expect(current()).toBe("o o *");

    swipe(80);
    expect(current()).toBe("o * o");
  });

  it("gesto curto ou mais vertical (rolagem) não troca", () => {
    render(<About />);
    swipe(-20);
    swipe(-60, 120);
    expect(current()).toBe("* o o");
  });

  it("bolinhas e setas do teclado também trocam", () => {
    render(<About />);
    fireEvent.click(dots()[2]);
    expect(current()).toBe("o o *");

    fireEvent.keyDown(dots()[2], { key: "ArrowLeft" });
    expect(current()).toBe("o * o");
    expect(document.activeElement).toBe(dots()[1]);
  });
});
