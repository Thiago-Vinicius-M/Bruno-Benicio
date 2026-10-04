/**
 * Gaveta lateral (menu do celular) — overlay escurece, painel desliza da esquerda e os
 * itens entram em sequência (stagger).
 *
 * Uma timeline PAUSADA, controlada pelo componente: open() toca, close() volta (reverse,
 * mais rápido). Os estados vêm de fromTo com autoAlpha, então fechado = visibility hidden:
 * nada da gaveta fica clicável ou focável enquanto está fechada.
 *
 * Com prefers-reduced-motion as durações são 0: abre e fecha na hora, sem deslizar.
 * Quando uma condição do gsap.matchMedia muda, tudo é revertido e recriado FECHADO.
 */
import { gsap } from "./gsap";
import { MEDIA, type MediaConditions } from "./media";

export type DrawerParams = {
  /** duração do overlay e do painel ao abrir, em segundos */
  duration: number;
  ease: string;
  /** deslocamento inicial dos itens, em px (da esquerda) */
  itemX: number;
  /** intervalo entre o início de cada item, em segundos */
  itemStagger: number;
  /** quando os itens começam, em relação ao painel (position parameter) */
  itemsPosition: string;
  /** velocidade do fechamento (2 = fecha no dobro da velocidade) */
  closeSpeed: number;
};

export type DrawerElements = {
  overlay: HTMLElement;
  panel: HTMLElement;
  items: HTMLElement[];
};

export function createDrawer(el: DrawerElements, params: DrawerParams) {
  const mm = gsap.matchMedia();
  let tl: gsap.core.Timeline | undefined;

  mm.add(MEDIA, (context) => {
    const { reduceMotion } = context.conditions as MediaConditions;
    const k = reduceMotion ? 0 : 1;

    tl = gsap
      .timeline({ paused: true, defaults: { ease: params.ease, duration: params.duration * k } })
      .fromTo(el.overlay, { autoAlpha: 0 }, { autoAlpha: 1 }, 0)
      .fromTo(el.panel, { autoAlpha: 0, xPercent: -100 }, { autoAlpha: 1, xPercent: 0 }, 0)
      .fromTo(
        el.items,
        { autoAlpha: 0, x: -params.itemX * k },
        { autoAlpha: 1, x: 0, stagger: params.itemStagger * k },
        reduceMotion ? 0 : params.itemsPosition,
      );
  });

  return {
    mm,
    open: () => tl?.timeScale(1).play(),
    close: () => tl?.timeScale(params.closeSpeed).reverse(),
  };
}
