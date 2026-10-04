import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ScrollTrigger } from "@/animations/gsap";
import { resetPageReady } from "@/lib/pageReady";
import { Hero } from "./Hero";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function parts() {
  const [logo, photo] = Array.from(document.querySelectorAll<HTMLElement>("#home img"));
  const title = screen.getByRole("heading", { level: 1, hidden: true });
  return { logo, photo, title };
}

/* O jsdom não roda o ticker do GSAP com layout real: testamos o estado antes da entrada. */
describe("Hero — entrada", () => {
  beforeEach(() => resetPageReady());

  it("antes da página ficar pronta, logo, foto e título esperam ocultos (sob o loading)", () => {
    render(<Hero />);
    const { logo, photo, title } = parts();

    for (const el of [logo, photo, title]) expect(el.style.visibility).toBe("hidden");
    // O stagger do título só é criado quando a entrada chega nele: só o parallax existe.
    expect(ScrollTrigger.getAll()).toHaveLength(1);
  });

  it("desmontar remove a entrada e devolve os elementos ao CSS", () => {
    const { unmount } = render(<Hero />);
    unmount();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  it("com prefers-reduced-motion nada fica oculto", () => {
    window.__matchingQueries.add(REDUCED_MOTION);
    render(<Hero />);

    for (const el of Object.values(parts())) {
      expect(el.style.visibility).toBe("");
      expect(el.style.opacity).toBe("");
    }
  });
});
