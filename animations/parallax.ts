/**
 * Parallax por scroll — camadas se movendo em velocidades diferentes.
 *
 * Ao rolar, todo o conteúdo sobe na mesma velocidade. Cada camada recebe um deslocamento
 * EXTRA enquanto o trigger atravessa a tela e passa a se mover numa velocidade diferente
 * da página — o cérebro interpreta essa diferença como profundidade:
 *   "down" (yPercent positivo) → sobe mais devagar que a página → parece mais longe (fundo)
 *   "up"   (yPercent negativo) → sobe mais rápido que a página  → parece mais perto (frente)
 *
 * O deslocamento é % da altura da PRÓPRIA camada (yPercent) — ou do trigger, com
 * relativeTo "trigger" — então acompanha o tamanho renderizado em qualquer largura de tela.
 *
 * Só transform é animado: barato para o navegador e sem alterar layout ou tamanho.
 * O trigger não é animado — apenas as camadas dentro dele.
 */
import { gsap } from "./gsap";
import { MEDIA, type MediaConditions } from "./media";

export type ParallaxLayer = {
  /** deslocamento total, em % da altura da referência (0–100) */
  intensity: number;
  /** "down" = fundo (mais lenta que a página) · "up" = frente (mais rápida) */
  direction: "up" | "down";
  /**
   * Referência do intensity: "self" (padrão) = altura da própria camada · "trigger" =
   * altura do trigger. Use "trigger" para camadas de alturas muito diferentes (ex.: uma
   * linha de texto ao lado de uma foto) andarem em escalas comparáveis.
   */
  relativeTo?: "self" | "trigger";
};

export type ParallaxParams = {
  /** multiplicador das intensidades em telas ≤ 767px */
  mobileFactor: number;
  scrub: boolean | number;
  start: string;
  end: string;
  markers: boolean;
};

export type ParallaxTarget = ParallaxLayer & { element: HTMLElement };

export function createParallax(trigger: HTMLElement, layers: ParallaxTarget[], params: ParallaxParams) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { isMobile, reduceMotion } = context.conditions as MediaConditions;
    if (reduceMotion) return; // camadas paradas na posição original

    // Telas pequenas + rolagem por toque (com inércia) deixam parallax forte enjoativo.
    const factor = isMobile ? params.mobileFactor : 1;

    // Uma timeline com um único ScrollTrigger move todas as camadas em sincronia.
    // scrub + ease "none": o deslocamento é proporcional ao scroll (velocidade constante).
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        id: "parallax",
        trigger,
        start: params.start,
        end: params.end,
        scrub: params.scrub,
        markers: params.markers,
        invalidateOnRefresh: true, // recalcula o y em px das camadas "trigger" no resize
      },
    });

    for (const { element, intensity, direction, relativeTo = "self" } of layers) {
      const percent = (direction === "up" ? -intensity : intensity) * factor;
      if (relativeTo === "trigger") {
        tl.fromTo(element, { y: 0 }, { y: () => (trigger.offsetHeight * percent) / 100 }, 0);
      } else {
        tl.fromTo(element, { yPercent: 0 }, { yPercent: percent }, 0);
      }
    }
  });

  return mm;
}
