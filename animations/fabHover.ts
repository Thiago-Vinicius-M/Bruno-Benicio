/**
 * Botão flutuante "Gerar link" do painel (só no celular) — no hover/foco o botão cresce um
 * pouco e o "+" gira. Num toque, o pointerenter/pointerleave do próprio toque dá o mesmo
 * retorno, rápido.
 *
 * Uma timeline PAUSADA: entrar toca, sair volta (reverse). Fora do celular nada é criado
 * (o botão volta ao topo). Com prefers-reduced-motion também nada é criado.
 * Quando uma condição do gsap.matchMedia muda, tudo é revertido e recriado.
 */
import { gsap } from "./gsap";
import { MEDIA, type MediaConditions } from "./media";

export type FabHoverParams = {
  /** escala do botão no hover */
  scale: number;
  /** giro do "+" no hover, em graus */
  iconRotation: number;
  /** duração da entrada, em segundos */
  duration: number;
  ease: string;
  /** velocidade da saída (2 = volta no dobro da velocidade) */
  leaveSpeed: number;
};

export const FAB_HOVER: FabHoverParams = {
  scale: 1.06,
  iconRotation: 90,
  duration: 0.35,
  ease: "back.out(2)",
  leaveSpeed: 1.6,
};

export function createFabHover(button: HTMLElement, icon: HTMLElement, params: FabHoverParams = FAB_HOVER) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { isMobile, reduceMotion } = context.conditions as MediaConditions;
    if (!isMobile || reduceMotion) return;

    const tl = gsap
      .timeline({ paused: true, defaults: { duration: params.duration, ease: params.ease } })
      .to(button, { scale: params.scale }, 0)
      .to(icon, { rotation: params.iconRotation }, 0);

    const enter = () => tl.timeScale(1).play();
    const leave = () => tl.timeScale(params.leaveSpeed).reverse();
    const events: [string, () => void][] = [
      ["pointerenter", enter],
      ["pointerleave", leave],
      ["focus", enter],
      ["blur", leave],
    ];
    for (const [name, handler] of events) button.addEventListener(name, handler);

    return () => {
      for (const [name, handler] of events) button.removeEventListener(name, handler);
    };
  });

  return mm;
}
