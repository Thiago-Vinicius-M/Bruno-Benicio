/**
 * Texto scrubbed — a barra de rolagem controla o playhead da animação.
 *
 * Toda animação tem um playhead (progress 0 = início, 1 = fim). Com `scrub`, quem move o
 * playhead é o scroll entre start e end: rolou 30% do trecho → a animação está em 30%;
 * parou de rolar → ela para; rolou para cima → ela volta.
 *   scrub: true → o playhead pula exatamente para a posição do scroll (resposta imediata)
 *   scrub: 1    → o playhead leva 1s para alcançar o scroll (suavizado, com "inércia")
 *
 * Com scrub, a duração do tween não importa: a animação é esticada entre start e end.
 * ease "none" mantém a relação linear (10% de scroll = 10% de movimento).
 *
 * fromTo define os dois extremos explicitamente (x inicial → x final); nenhum deles é o
 * do CSS. O trigger não é animado — apenas a linha de texto dentro dele.
 */
import { gsap } from "./gsap";
import { MEDIA, type MediaConditions } from "./media";

export type ScrubTextParams = {
  scrub: true | number;
  /** x no início do trecho (progress 0), em px */
  fromX: number;
  /** x no fim do trecho (progress 1), em px */
  toX: number;
  ease: string;
  start: string;
  end: string;
  markers: boolean;
};

export function createScrubText(trigger: HTMLElement, line: HTMLElement, params: ScrubTextParams) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { isMobile, reduceMotion } = context.conditions as MediaConditions;
    if (reduceMotion) return; // texto parado, no lugar definido pelo CSS

    // A mesma distância em px é proporcionalmente bem maior numa tela estreita:
    // no mobile usamos metade para manter a proporção visual.
    const factor = isMobile ? 0.5 : 1;

    gsap.fromTo(
      line,
      { x: params.fromX * factor },
      {
        x: params.toX * factor,
        ease: params.ease,
        scrollTrigger: {
          id: "scrub-text",
          trigger,
          start: params.start,
          end: params.end,
          scrub: params.scrub,
          markers: params.markers,
        },
      },
    );
  });

  return mm;
}
