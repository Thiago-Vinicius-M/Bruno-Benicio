import type { FadeSlideParams, FadeSlideStepParams } from "@/animations/fadeSlide";

export type ShowRevealConfig = FadeSlideParams & {
  heading: FadeSlideStepParams;
  packages: FadeSlideStepParams;
  details: FadeSlideStepParams;
};

/**
 * Entrada da seção NOSSO SHOW — mesma animação (animations/fadeSlide.ts) e mesmos valores
 * da seção MÚSICAS, para as duas parecerem do mesmo site. Grupos, na ordem:
 *   heading  → título e "Orçamento de shows"
 *   packages → formatos com preço, um depois do outro
 *   details  → repertório e o que o show inclui
 *
 * Por passo: y (px abaixo) · blur (px) · stagger (s entre itens) · position (quando começa:
 * "-=0.5" sobrepõe 0.5s ao anterior). Geral: ver musicReveal.ts — os campos são os mesmos.
 * mobile: true = a entrada também acontece no celular.
 */
export const SHOW_REVEAL: ShowRevealConfig = {
  duration: 0.9,
  ease: "power3.out",
  intensity: 1,
  mobileFactor: 0.6,
  start: "top 70%",
  toggleActions: "play none none none",
  markers: false,
  mobile: true,

  heading: { y: 28, blur: 6, stagger: 0.12 },
  packages: { y: 24, stagger: 0.1, duration: 0.7, position: "-=0.5" },
  details: { y: 24, stagger: 0.12, position: "-=0.4" },
};
