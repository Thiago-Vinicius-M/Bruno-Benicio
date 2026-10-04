import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollTrigger } from "@/animations/gsap";
import { ExperienceProvider } from "@/components/Experience/ExperienceProvider";
import { Videos } from "./Videos";

function renderVideos() {
  return render(
    <ExperienceProvider>
      <Videos />
    </ExperienceProvider>,
  );
}

describe("Videos — entrada", () => {
  it("desktop: mantém a timeline cinematic com pin", () => {
    renderVideos();
    expect(ScrollTrigger.getAll().some((trigger) => trigger.pin)).toBe(true);
  });

  it("celular: sem animação de entrada nem pin — frase, título e vídeos já no lugar", () => {
    window.__matchingQueries = new Set(["(max-width: 767px)"]);
    renderVideos();

    expect(ScrollTrigger.getAll()).toHaveLength(0);
    for (const el of document.querySelectorAll<HTMLElement>("#videos p, #videos h2, #videos [data-highlights]")) {
      expect(el.style.visibility).toBe("");
      expect(el.style.transform).toBe("");
    }
  });
});
