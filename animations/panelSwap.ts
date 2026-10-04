/**
 * Troca de painéis lado a lado (ex.: Bruno ↔ Benício) — o painel atual sai para um lado
 * enquanto o próximo entra pelo outro, no sentido da navegação (direction 1 = avançar: sai
 * pela esquerda, entra pela direita · -1 = voltar).
 *
 * Os dois painéis ocupam o mesmo lugar (CSS); quem decide qual aparece é o CSS do
 * componente (painel inativo = visibility hidden). A animação só cobre a troca: ao terminar,
 * as propriedades inline são limpas e o CSS volta a mandar — então nada fica "preso" se o
 * usuário trocar várias vezes seguidas (overwrite interrompe a troca anterior).
 *
 * Com prefers-reduced-motion: troca direta, sem animação.
 */
import { gsap } from "./gsap";
import { MEDIA, type MediaConditions } from "./media";

export type PanelSwapParams = {
  /** duração de cada painel, em segundos */
  duration: number;
  ease: string;
  /** deslocamento dos painéis, em % da largura deles */
  shift: number;
  /** quando o próximo começa a entrar, em relação à saída do atual (position parameter) */
  enterPosition: string;
};

export function createPanelSwap(
  outgoing: HTMLElement,
  incoming: HTMLElement,
  direction: 1 | -1,
  params: PanelSwapParams,
) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { reduceMotion } = context.conditions as MediaConditions;
    if (reduceMotion) return;

    gsap
      .timeline({ defaults: { ease: params.ease, duration: params.duration, overwrite: true } })
      .fromTo(
        outgoing,
        { autoAlpha: 1, xPercent: 0 },
        { autoAlpha: 0, xPercent: -direction * params.shift, clearProps: "opacity,visibility,transform" },
        0,
      )
      .fromTo(
        incoming,
        { autoAlpha: 0, xPercent: direction * params.shift },
        { autoAlpha: 1, xPercent: 0, clearProps: "opacity,visibility,transform" },
        params.enterPosition,
      );
  });

  return mm;
}
