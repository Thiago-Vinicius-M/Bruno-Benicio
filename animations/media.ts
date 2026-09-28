/**
 * Condições usadas com gsap.matchMedia().
 *
 * isMobile/isTablet/isDesktop cobrem todas as larguras, então a função registrada sempre roda
 * e cada animação decide o que fazer lendo `context.conditions`. Quando alguma condição muda
 * (ex.: a janela passa de 1200px para 600px), o GSAP reverte tudo o que foi criado e executa
 * a função de novo — sem ScrollTriggers duplicados.
 */
export const MEDIA = {
  isMobile: "(max-width: 767px)",
  isTablet: "(min-width: 768px) and (max-width: 1023px)",
  isDesktop: "(min-width: 1024px)",
  reduceMotion: "(prefers-reduced-motion: reduce)",
} as const;

export type MediaConditions = Record<keyof typeof MEDIA, boolean>;
