"use client";

import { useSyncExternalStore } from "react";
import { MEDIA } from "@/animations/media";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(MEDIA.isMobile);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * true quando a galeria está no layout de celular (uma coluna, ≤ 767px — o mesmo
 * breakpoint do CSS da galeria). Acompanha redimensionar a janela e girar o aparelho.
 * No servidor (e na hidratação) vale o desktop; o que depende disso só aparece depois
 * de uma interação (o "Ver mais"), então não há divergência de hidratação.
 */
export function useIsMobileLayout(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MEDIA.isMobile).matches,
    () => false,
  );
}
