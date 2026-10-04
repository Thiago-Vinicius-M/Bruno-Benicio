import { beforeEach, describe, expect, it, vi } from "vitest";
import { isPageReady, markPageReady, onPageReady, resetPageReady } from "./pageReady";

describe("pageReady", () => {
  beforeEach(() => resetPageReady());

  it("avisa as inscrições quando a página fica pronta, uma única vez", () => {
    const listener = vi.fn();
    onPageReady(listener);
    expect(listener).not.toHaveBeenCalled();

    markPageReady();
    markPageReady();
    expect(isPageReady()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("com a página já pronta, executa na hora", () => {
    markPageReady();
    const listener = vi.fn();
    onPageReady(listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("inscrição cancelada não é chamada", () => {
    const listener = vi.fn();
    const cancel = onPageReady(listener);
    cancel();
    markPageReady();
    expect(listener).not.toHaveBeenCalled();
  });
});
