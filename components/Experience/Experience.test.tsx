import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { markPageReady, resetPageReady } from "@/lib/pageReady";
import { ExperienceProvider } from "./ExperienceProvider";
import { MoreButton } from "./MoreButton";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function Page() {
  return (
    <ExperienceProvider>
      <header data-experience-home>topo</header>
      <main data-experience-home>
        <MoreButton experience="videos" only="mobile" />
      </main>
    </ExperienceProvider>
  );
}

const main = () => document.querySelector("main")!;
/** Título da subtela aberta (aria-labelledby), ou null. */
const dialogTitle = () => {
  const dialog = screen.queryByRole("dialog", { hidden: true });
  return dialog && document.getElementById(dialog.getAttribute("aria-labelledby")!)!.textContent;
};
const link = (name: string) => document.querySelector<HTMLAnchorElement>(`a[href="#ver/${name}"]`)!;

/*
 * O jsdom não roda o ticker com layout real: a transição usa o fade curto (reduced motion) e
 * a subtela fica no estado inicial dele (oculta) — por isso as consultas usam hidden: true.
 */
describe("Subtelas (ExperienceProvider)", () => {
  beforeEach(() => {
    resetPageReady();
    history.replaceState(null, "", "/");
    window.__matchingQueries.add(REDUCED_MOTION);
  });

  afterEach(() => {
    document.documentElement.style.overflow = "";
  });

  it("'Ver mais' é um link para o hash da subtela (funciona sem JS / em nova aba)", () => {
    render(<Page />);
    expect(link("videos").textContent).toContain("Ver mais");
    expect(link("videos").getAttribute("data-only")).toBe("mobile");
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
  });

  it("abrir: subtela com título, hash no histórico, Home inerte e página sem rolagem", () => {
    render(<Page />);
    fireEvent.click(link("videos"));

    expect(dialogTitle()).toBe("VIDEOS");
    expect(location.hash).toBe("#ver/videos");
    expect(history.state).toEqual({ experience: "videos" });
    for (const el of document.querySelectorAll<HTMLElement>("[data-experience-home]")) expect(el.inert).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");
    // voltar no topo (fixo) e no fim do conteúdo
    const buttons = [...screen.getByRole("dialog", { hidden: true }).querySelectorAll("button")];
    expect(buttons.filter((button) => button.textContent === "← Voltar")).toHaveLength(2);
  });

  it("voltar do navegador fecha a subtela, devolve a Home e o foco ao 'Ver mais'", async () => {
    render(<Page />);
    fireEvent.click(link("videos"));
    expect(dialogTitle()).toBe("VIDEOS");

    act(() => {
      history.replaceState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).toBeNull());
    expect(main().inert).toBe(false);
    expect(main().getAttribute("style") ?? "").toBe("");
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.activeElement).toBe(link("videos"));
  });

  it("Esc / botão voltar com a subtela aberta por link direto: fecha e tira o hash da URL", async () => {
    history.replaceState(null, "", "/#ver/videos");
    render(<Page />);
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull(); // espera o loading

    act(() => markPageReady());
    expect(dialogTitle()).toBe("VIDEOS");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).toBeNull());
    expect(location.hash).toBe("");
  });

  it("Ctrl+clique segue o link (nova aba) sem abrir a subtela aqui", () => {
    render(<Page />);
    fireEvent.click(link("videos"), { ctrlKey: true });
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
  });
});
