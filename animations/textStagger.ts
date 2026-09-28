/**
 * Texto com stagger — um tween, vários alvos, inícios escalonados.
 *
 * Em vez de um tween por palavra, UM tween recebe todos os alvos e `stagger` defasa o
 * início de cada um:
 *
 *   palavra 1  ▶━━━━━━━━┓
 *   palavra 2    ▶━━━━━━━━┓        ← cada uma começa `each` segundos depois da anterior
 *   palavra 3      ▶━━━━━━━━┓
 *
 * Efeito "máscara": cada alvo fica dentro de um elemento com overflow: hidden (CSS).
 * yPercent 110 → 0 faz o texto "subir de dentro da linha" (110% da altura do próprio alvo
 * = começa totalmente escondido abaixo da máscara).
 *
 * Os alvos são os elementos com o atributo `data-stagger-target` dentro do container.
 * O container é o trigger e não é animado.
 */
import { gsap } from "./gsap";
import { MEDIA, type MediaConditions } from "./media";

export type StaggerFrom = "start" | "center" | "end" | "edges" | "random";

export type TextStaggerParams = {
  /** divide a frase em palavras ou letras (feito no JSX do componente) */
  split: "words" | "chars";
  /** "each" = intervalo fixo entre alvos · "amount" = tempo total do escalonamento */
  staggerMode: "each" | "amount";
  staggerValue: number;
  from: StaggerFrom;
  yPercent: number;
  rotation: number;
  /** duração de CADA alvo, em segundos */
  duration: number;
  ease: string;
  start: string;
  toggleActions: string;
  markers: boolean;
};

export function createTextStagger(container: HTMLElement, params: TextStaggerParams) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { isMobile, reduceMotion } = context.conditions as MediaConditions;
    if (reduceMotion) return; // frase estática e legível

    const targets = gsap.utils.toArray<HTMLElement>("[data-stagger-target]", container);

    gsap.from(targets, {
      yPercent: params.yPercent,
      // no mobile a frase quebra em várias linhas: rotação menor fica mais limpa
      rotation: isMobile ? params.rotation / 2 : params.rotation,
      opacity: 0,
      duration: params.duration,
      ease: params.ease,
      stagger:
        params.staggerMode === "each"
          ? { each: params.staggerValue, from: params.from }
          : { amount: params.staggerValue, from: params.from },
      scrollTrigger: {
        id: "text-stagger",
        trigger: container,
        start: params.start,
        toggleActions: params.toggleActions,
        markers: params.markers,
      },
    });
  });

  return mm;
}
