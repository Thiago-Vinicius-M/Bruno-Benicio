/**
 * Entrada ao abrir a página — a mesma sequência do fadeSlide (grupos surgindo com fade,
 * y, escala, blur e recorte), mas sem ScrollTrigger: toca UMA vez, quando a página fica
 * pronta (fim da tela de loading, ver lib/pageReady.ts).
 *
 * Os estados iniciais são aplicados na criação (fromTo com immediateRender), ainda por baixo
 * do loading — então não há flash do conteúdo antes da entrada. O estado FINAL é o layout
 * do CSS: com prefers-reduced-motion nada é criado e o conteúdo já aparece pronto.
 *
 * `cue` (opcional) entrega uma parte da entrada a OUTRA animação num ponto da sequência:
 * os elementos `hidden` ficam ocultos até lá e então `run()` é chamado (uma única vez).
 * Ex.: o título do Hero, cujo stagger já existe e tem o próprio ScrollTrigger.
 *
 * A entrada não se repete: se o gsap.matchMedia recriar tudo (ex.: o celular gira e passa
 * de um breakpoint) depois que ela já começou, os elementos ficam direto no estado final.
 */
import type { FadeSlideStep } from "./fadeSlide";
import { addFadeSlideSteps } from "./fadeSlide";
import { gsap } from "./gsap";
import { MEDIA, type MediaConditions } from "./media";
import { onPageReady } from "@/lib/pageReady";

export type IntroRevealParams = {
  /** espera, em segundos, entre a página ficar pronta e a entrada começar */
  delay: number;
  /** duração padrão de cada passo, em segundos */
  duration: number;
  ease: string;
  /** multiplicador de y, blur e escala (0 = só fade · 1 = como configurado) */
  intensity: number;
  /** multiplicador extra em telas ≤ 767px */
  mobileFactor: number;
};

export type IntroCue = {
  /** quando, na sequência, a outra animação assume (position parameter) */
  position: string;
  /** elementos mantidos ocultos até o cue */
  hidden: HTMLElement[];
  run: () => void;
};

export function createIntroReveal(steps: FadeSlideStep[], params: IntroRevealParams, cue?: IntroCue) {
  const mm = gsap.matchMedia();
  let started = false;
  let cued = false;

  const fireCue = () => {
    if (cued || !cue) return;
    cued = true;
    gsap.set(cue.hidden, { clearProps: "opacity,visibility" });
    cue.run();
  };

  mm.add(MEDIA, (context) => {
    const { isMobile, reduceMotion } = context.conditions as MediaConditions;
    if (reduceMotion || started) {
      fireCue(); // composição final estática (CSS)
      return;
    }

    if (cue && !cued) gsap.set(cue.hidden, { autoAlpha: 0 });

    const tl = gsap.timeline({ paused: true, defaults: { ease: params.ease, duration: params.duration } });
    if (params.delay > 0) tl.set({}, {}, params.delay); // os passos sem position começam depois da espera
    addFadeSlideSteps(tl, steps, params.intensity * (isMobile ? params.mobileFactor : 1));
    if (cue) tl.call(fireCue, undefined, cue.position);

    // O retorno é o cleanup do matchMedia: cancela a espera se tudo for revertido antes.
    return onPageReady(() => {
      started = true;
      tl.play();
    });
  });

  return mm;
}
