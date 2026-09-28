/**
 * ============================================================================
 * MEDIA QUERIES usadas com gsap.matchMedia()
 * ============================================================================
 *
 * gsap.matchMedia() executa uma função quando as condições batem e REVERTE
 * automaticamente tudo o que foi criado nela (tweens, timelines,
 * ScrollTriggers, gsap.set...) quando alguma condição muda. Exemplo: você
 * redimensiona a janela de 1200px para 600px → a versão desktop é desfeita e
 * a versão mobile é criada, sem vazamentos nem ScrollTriggers duplicados.
 *
 * Uso nos exemplos:
 *
 *   const mm = gsap.matchMedia();
 *   mm.add(MEDIA, (context) => {
 *     const { isMobile, reduceMotion } = context.conditions as MediaConditions;
 *     if (reduceMotion) return;          // versão sem movimento
 *     gsap.to(el, { x: isMobile ? 100 : 300, scrollTrigger: {...} });
 *   });
 *
 * Com o objeto de condições, a função roda quando QUALQUER condição bate e é
 * executada de novo quando QUALQUER uma muda. Como isMobile/isTablet/isDesktop
 * cobrem todas as larguras, a função sempre roda — e você decide o que fazer
 * lendo os booleanos em `context.conditions`.
 *
 * Docs: https://gsap.com/docs/v3/GSAP/gsap.matchMedia()
 * (ScrollTrigger.matchMedia() está DEPRECIADO — use gsap.matchMedia().)
 */
export const MEDIA = {
  isMobile: "(max-width: 767px)",
  isTablet: "(min-width: 768px) and (max-width: 1023px)",
  isDesktop: "(min-width: 1024px)",
  reduceMotion: "(prefers-reduced-motion: reduce)",
} as const;

export type MediaConditions = Record<keyof typeof MEDIA, boolean>;
