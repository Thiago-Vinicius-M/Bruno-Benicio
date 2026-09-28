/**
 * Lê uma media query no React (apenas para a UI do laboratório — ex.: mostrar
 * no cabeçalho se "prefers-reduced-motion" está ativo). As ANIMAÇÕES usam
 * gsap.matchMedia(), que também reverte/recria os tweens automaticamente.
 */
import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
