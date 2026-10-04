/**
 * Saída da tela de loading — o logo se recolhe e a tela sobe como uma cortina
 * (clip-path), revelando a página de baixo para cima.
 *
 * A ENTRADA do logo é feita em CSS (Loader.module.css): ela precisa rodar antes da
 * hidratação, quando o GSAP ainda não carregou. Por isso a saída anima o wrapper do logo
 * (`mark`) e nunca a imagem — uma animação CSS com fill sobrescreveria os estilos inline.
 *
 * `onReveal` é chamado quando a cortina começa a subir (momento de a página iniciar a
 * própria entrada) e `onComplete` quando a tela some por completo.
 *
 * Com prefers-reduced-motion: só um fade curto, sem movimento.
 */
import { gsap } from "./gsap";
import { MEDIA, type MediaConditions } from "./media";

export type LoaderExitParams = {
  /** duração do recolhimento do logo, em segundos */
  logoDuration: number;
  /** quanto o logo sobe ao sair, em px */
  logoY: number;
  /** escala final do logo ao sair */
  logoScale: number;
  /** duração da cortina subindo, em segundos */
  curtainDuration: number;
  /** quanto a cortina começa antes do fim do logo, em segundos */
  curtainOverlap: number;
  curtainEase: string;
  /** duração do fade com prefers-reduced-motion, em segundos */
  reducedFadeDuration: number;
};

export type LoaderExitElements = {
  /** a tela inteira (fundo) */
  root: HTMLElement;
  /** wrapper do logo */
  mark: HTMLElement;
};

export type LoaderExitCallbacks = {
  onReveal: () => void;
  onComplete: () => void;
};

export function createLoaderExit(el: LoaderExitElements, params: LoaderExitParams, callbacks: LoaderExitCallbacks) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { reduceMotion } = context.conditions as MediaConditions;

    // A página por baixo já pode receber cliques/toques enquanto a tela sai.
    gsap.set(el.root, { pointerEvents: "none" });

    if (reduceMotion) {
      callbacks.onReveal();
      gsap.to(el.root, {
        autoAlpha: 0,
        duration: params.reducedFadeDuration,
        ease: "none",
        onComplete: callbacks.onComplete,
      });
      return;
    }

    gsap
      .timeline({ onComplete: callbacks.onComplete })
      .to(el.mark, {
        autoAlpha: 0,
        y: -params.logoY,
        scale: params.logoScale,
        duration: params.logoDuration,
        ease: "power2.in",
      })
      .call(callbacks.onReveal, undefined, `-=${params.curtainOverlap}`)
      .to(
        el.root,
        { clipPath: "inset(0% 0% 100% 0%)", duration: params.curtainDuration, ease: params.curtainEase },
        "<",
      );
  });

  return mm;
}
