import type { FadeSlideParams, FadeSlideStepParams } from "@/animations/fadeSlide";
import type { TextStaggerParams } from "@/animations/textStagger";

/**
 * Entrada do parágrafo "Agora que você já conhece..." (animations/fadeSlide.ts): surge
 * subindo e saindo do desfoque, um pouco depois da frase de cima começar.
 * Parâmetros: ver components/Music/musicReveal.ts.
 */
export const MODELS_TEXT_REVEAL: FadeSlideParams & { text: FadeSlideStepParams } = {
  duration: 0.9,
  ease: "power3.out",
  intensity: 1,
  mobileFactor: 0.6,
  start: "top 85%",
  toggleActions: "play none none reverse",
  markers: false,
  text: { y: 24, blur: 6, position: "+=0.35" },
};

/**
 * Entrada da frase "EAI, GOSTOU?" (Models.tsx) — mesmo efeito do título do Hero
 * (animations/textStagger.ts): cada palavra sobe de dentro da própria linha, uma depois da
 * outra. Parâmetros: ver components/Hero/heroTitleStagger.ts.
 *
 * split "chars" anima letra por letra (mais marcado numa frase curta como esta).
 */
export const MODELS_TITLE_STAGGER: TextStaggerParams = {
  split: "chars",
  staggerMode: "each",
  staggerValue: 0.04,
  from: "start",
  yPercent: 110,
  rotation: 8,
  duration: 0.7,
  ease: "power3.out",
  start: "top 80%",
  toggleActions: "play none none reverse",
  markers: false,
};
