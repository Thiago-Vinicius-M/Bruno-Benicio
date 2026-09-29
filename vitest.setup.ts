import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * O jsdom não implementa matchMedia (usado pelo gsap.matchMedia). As media queries que
 * "batem" ficam em `window.__matchingQueries` — por padrão, desktop sem reduced motion.
 */
declare global {
  interface Window {
    __matchingQueries: Set<string>;
  }
}

export const DESKTOP_QUERY = "(min-width: 1024px)";

window.__matchingQueries = new Set([DESKTOP_QUERY]);

window.matchMedia = (query: string) =>
  ({
    matches: window.__matchingQueries.has(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

afterEach(() => {
  cleanup();
  window.__matchingQueries = new Set([DESKTOP_QUERY]);
});
