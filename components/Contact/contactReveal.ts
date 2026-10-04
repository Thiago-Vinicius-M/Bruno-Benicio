import type { FadeSlideParams, FadeSlideStepParams } from "@/animations/fadeSlide";

/**
 * Entrada da seção CONTATO — a mesma animação (animations/fadeSlide.ts) e os mesmos valores
 * das seções MÚSICAS e NOSSO SHOW. Um grupo só: "Contrate agora!", telefones e Instagram
 * surgem um depois do outro (stagger). Campos: ver musicReveal.ts.
 */
export const CONTACT_REVEAL: FadeSlideParams & { cta: FadeSlideStepParams } = {
  duration: 0.9,
  ease: "power3.out",
  intensity: 1,
  mobileFactor: 0.6,
  start: "top 75%",
  toggleActions: "play none none none",
  markers: false,
  mobile: true,

  cta: { y: 32, scale: 0.97, stagger: 0.12 },
};
