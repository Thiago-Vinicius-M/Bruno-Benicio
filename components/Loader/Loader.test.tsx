import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { markPageReady, resetPageReady } from "@/lib/pageReady";
import { Loader } from "./Loader";

describe("Loader", () => {
  beforeEach(() => resetPageReady());

  it("cobre a página com o logo enquanto ela não está pronta", () => {
    render(<Loader />);
    const status = screen.getByRole("status", { name: "Carregando" });
    expect(status.querySelector("img")).toBeTruthy();
  });

  it("não aparece de novo quando a página já está pronta (navegação client-side)", () => {
    markPageReady();
    render(<Loader />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
