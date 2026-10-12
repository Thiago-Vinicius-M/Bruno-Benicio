import type { FadeSlideParams, FadeSlideStepParams } from "@/animations/fadeSlide";
import type { PanelSwapParams } from "@/animations/panelSwap";
import type { ParallaxLayer, ParallaxParams } from "@/animations/parallax";

export type AgendaRevealConfig = FadeSlideParams & {
  heading: FadeSlideStepParams;
  rows: FadeSlideStepParams;
  controls: FadeSlideStepParams;
};

/**
 * Entrada da seção AGENDA — todos os valores ajustáveis do efeito ficam aqui.
 *
 * SEQUÊNCIA (toca quando a seção entra na tela, também no celular)
 *   heading  → título "AGENDA" e o mês, um depois do outro
 *   rows     → linhas da primeira página, de cima para baixo, desfocadas → nítidas
 *   controls → bolinhas das páginas (quando há mais de 7 shows)
 *
 * Parâmetros: ver components/Music/musicReveal.ts (mesmo efeito, animations/fadeSlide.ts).
 */
export const AGENDA_REVEAL: AgendaRevealConfig = {
  duration: 0.9,
  ease: "power3.out",
  intensity: 1,
  mobileFactor: 0.6,
  start: "top 75%",
  toggleActions: "play none none none",
  markers: false,
  mobile: true,

  heading: { y: 28, blur: 6, stagger: 0.12 },
  rows: { y: 24, blur: 4, stagger: 0.07, duration: 0.7, position: "-=0.5" },
  controls: { y: 12, duration: 0.6, position: "-=0.3" },
};

/**
 * Parallax ao rolar (animations/parallax.ts) — o mesmo efeito do SOBRE NÓS: enquanto a
 * seção atravessa a tela, o título fica um pouco para trás e a lista vem à frente, nos dois
 * sentidos do scroll. intensity em % da altura da seção (relativeTo "trigger").
 * Parâmetros: ver components/About/aboutParallax.ts.
 */
export const AGENDA_PARALLAX = {
  heading: { intensity: 6, direction: "down", relativeTo: "trigger" },
  list: { intensity: 6, direction: "up", relativeTo: "trigger" },
  mobileFactor: 0.3,
  scrub: 0.6,
  start: "top bottom",
  end: "bottom top",
  markers: false,
} satisfies ParallaxParams & Record<"heading" | "list", ParallaxLayer>;

/** Quantos shows cabem numa página; o resto vai para as páginas seguintes (arrastar para o lado). */
export const AGENDA_PAGE_SIZE = 7;

/**
 * Troca de página (mesmo efeito do carrossel do SOBRE NÓS, animations/panelSwap.ts): a
 * página sai para um lado e a próxima entra pelo outro, no sentido do arraste.
 * Parâmetros: ver components/About/aboutCarousel.ts.
 */
export const AGENDA_PAGE_SWAP: PanelSwapParams = {
  duration: 0.55,
  ease: "power3.out",
  shift: 12,
  enterPosition: "<0.12",
};

/** Arraste: distância horizontal mínima (px) para trocar de página (igual ao SOBRE NÓS). */
export const AGENDA_SWIPE_MIN = 40;
