/**
 * Transição lateral entre telas — a Home desliza para a esquerda e sai de cena enquanto a
 * subtela entra pela direita; depois os itens da subtela entram em sequência (stagger).
 * Voltar = a mesma timeline ao contrário (reverse), um pouco mais rápida.
 *
 * Uma timeline PAUSADA, controlada pelo componente: open() toca, close() volta e chama
 * `onClosed` quando termina. Só transform e opacity são animados. A Home termina com
 * autoAlpha 0 (visibility hidden): enquanto a subtela está aberta ela não é pintada.
 *
 * Com prefers-reduced-motion: só um fade curto entre as telas, sem deslocamento.
 * Se uma condição do gsap.matchMedia mudar com a subtela aberta (ex.: girar o celular), a
 * timeline é recriada e vai direto para o estado aberto.
 */
import { gsap } from "./gsap";
import { MEDIA, type MediaConditions } from "./media";

export type ScreenTransitionParams = {
  /** duração da saída da Home e da entrada da subtela, em segundos */
  duration: number;
  ease: string;
  /** quanto a Home anda para a esquerda ao sair, em % da largura dela */
  homeShift: number;
  /** quando a subtela começa a entrar, em relação à saída da Home (position parameter) */
  screenPosition: string;
  /** deslocamento inicial de cada item da subtela, em px (vindo da direita) */
  itemX: number;
  /** intervalo entre o início de cada item, em segundos */
  itemStagger: number;
  /** quando os itens começam, em relação à entrada da subtela (position parameter) */
  itemsPosition: string;
  /** velocidade da volta (1.3 = volta 30% mais rápido que a ida) */
  closeSpeed: number;
  /** duração do fade com prefers-reduced-motion, em segundos */
  reducedDuration: number;
};

export type ScreenTransitionElements = {
  /** o que forma a Home (ex.: header e main): sai pela esquerda */
  home: HTMLElement[];
  /** a subtela (camada fixa sobre a página): entra pela direita */
  screen: HTMLElement;
  /** itens da subtela que entram em sequência depois dela */
  items: HTMLElement[];
};

export function createScreenTransition(
  el: ScreenTransitionElements,
  params: ScreenTransitionParams,
  onClosed: () => void,
) {
  const mm = gsap.matchMedia();
  let tl: gsap.core.Timeline | undefined;
  let opened = false;

  mm.add(MEDIA, (context) => {
    const { reduceMotion } = context.conditions as MediaConditions;

    tl = gsap.timeline({
      paused: true,
      defaults: { ease: params.ease, duration: reduceMotion ? params.reducedDuration : params.duration },
      onReverseComplete: onClosed,
    });

    if (reduceMotion) {
      tl.fromTo(el.home, { autoAlpha: 1 }, { autoAlpha: 0 }, 0).fromTo(el.screen, { autoAlpha: 0 }, { autoAlpha: 1 });
    } else {
      tl.fromTo(el.home, { xPercent: 0, autoAlpha: 1 }, { xPercent: -params.homeShift, autoAlpha: 0 }, 0)
        .fromTo(el.screen, { xPercent: 100, autoAlpha: 1 }, { xPercent: 0, autoAlpha: 1 }, params.screenPosition)
        .fromTo(
          el.items,
          { autoAlpha: 0, x: params.itemX },
          { autoAlpha: 1, x: 0, stagger: params.itemStagger },
          params.itemsPosition,
        );
    }

    if (opened) tl.progress(1);
  });

  return {
    mm,
    open: () => {
      opened = true;
      tl?.timeScale(1).play();
    },
    close: () => {
      opened = false;
      // Ainda no início (fechou antes do primeiro frame da ida): reverse() não teria o que
      // voltar e onReverseComplete não dispararia.
      if (!tl || tl.progress() === 0) onClosed();
      else tl.timeScale(params.closeSpeed).reverse();
    },
  };
}
