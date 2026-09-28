/**
 * Deriva ambiente — movimento contínuo, lento e em vaivém (yoyo) das luzes e partículas
 * da atmosfera, como poeira flutuando na luz de um palco.
 *
 * Não depende do scroll: cada alvo recebe um tween infinito (repeat -1) de x/y com ease
 * "sine.inOut", que acelera e desacelera suavemente nos extremos — sem "tranco" na volta.
 * Durações e atrasos diferentes por alvo evitam que tudo se mova em sincronia.
 *
 * Só transform é animado (composição na GPU, sem repaint). Os alvos são os elementos
 * INTERNOS das camadas (formas dos glows e cada partícula); as camadas externas ficam
 * livres para outras animações (ex.: ScrollTrigger) sem disputar as mesmas propriedades.
 *
 * Com prefers-reduced-motion nada é criado: a atmosfera fica estática.
 */
import { gsap } from "./gsap";
import { MEDIA, type MediaConditions } from "./media";

export type AtmosphereDriftParams = {
  enabled: boolean;
  /** deslocamento máximo das luzes, em px */
  glowDistance: number;
  /** segundos de cada ida (a volta leva o mesmo tempo) */
  glowDuration: number;
  /** subida máxima das partículas, em px */
  particleDistance: number;
  particleDuration: number;
  /** multiplicador das distâncias em telas ≤ 767px */
  mobileFactor: number;
};

export type AtmosphereDriftElements = {
  glows: HTMLElement[];
  particles: HTMLElement[];
};

export function createAtmosphereDrift(el: AtmosphereDriftElements, params: AtmosphereDriftParams) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { isMobile, reduceMotion } = context.conditions as MediaConditions;
    if (reduceMotion || !params.enabled) return;

    const factor = isMobile ? params.mobileFactor : 1;
    const { random } = gsap.utils;

    // Luzes em direções opostas: uma se afasta enquanto a outra se aproxima.
    el.glows.forEach((glow, i) => {
      const side = i % 2 ? -1 : 1;
      gsap.to(glow, {
        x: side * params.glowDistance * factor,
        y: -side * params.glowDistance * 0.6 * factor,
        duration: params.glowDuration * (1 + i * 0.3),
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    });

    for (const particle of el.particles) {
      const duration = params.particleDuration * random(0.7, 1.3);
      gsap
        .to(particle, {
          y: -params.particleDistance * factor * random(0.5, 1),
          x: params.particleDistance * factor * random(-0.4, 0.4),
          duration,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        })
        .time(random(0, duration)); // cada partícula já começa num ponto diferente do ciclo
    }
  });

  return mm;
}
