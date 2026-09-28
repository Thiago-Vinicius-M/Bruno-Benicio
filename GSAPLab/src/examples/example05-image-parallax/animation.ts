/**
 * ============================================================================
 * EXEMPLO 05 — IMAGEM PARALLAX
 * ============================================================================
 *
 * CONCEITO: parallax = camadas se movendo em velocidades diferentes
 *   Quando você rola, TODO o conteúdo sobe na mesma velocidade. Se uma camada
 *   (a imagem) ganhar um deslocamento EXTRA dentro da sua moldura, ela passa a
 *   se mover numa velocidade diferente do resto — e o cérebro interpreta isso
 *   como profundidade:
 *     - imagem descendo dentro da moldura → sobe MAIS DEVAGAR que a página
 *       → parece estar mais LONGE (fundo)
 *     - imagem subindo dentro da moldura  → sobe MAIS RÁPIDO que a página
 *       → parece estar mais PERTO (primeiro plano)
 *
 * yPercent
 *   yPercent: -20 = transform: translateY(-20%) → 20% da altura DA PRÓPRIA
 *   IMAGEM (não da moldura!). É isso que decide se aparece "buraco":
 *
 *     moldura = 1 unidade de altura; imagem = H unidades; ancorada no topo
 *     no fim (yPercent -P), o topo da imagem está em −P·H
 *     a base da imagem está em  H − P·H = H·(1 − P)
 *     para cobrir a moldura:    H·(1 − P) ≥ 1   →   H ≥ 1 / (1 − P)
 *
 *     yPercent  -20 → H ≥ 1/0.8  = 1.25  (imagem 125% da moldura)
 *     yPercent  -50 → H ≥ 1/0.5  = 2     (imagem 200% da moldura)
 *     yPercent -100 → H ≥ 1/0    = ∞     (impossível: a imagem percorre a
 *                                         própria altura inteira e SAI da
 *                                         moldura — sempre sobra buraco)
 *
 *   A opção "compensar altura" aplica essa fórmula (limitada a 400%).
 *   Desligue-a para VER o buraco aparecer no fim do scroll.
 *
 * overflow: hidden (CSS da moldura)
 *   É o que transforma "uma imagem se movendo" em "uma janela para uma imagem
 *   que se move". Sem ele, a imagem invadiria o conteúdo vizinho.
 *
 * start / end
 *   "top bottom" → "bottom top": o parallax acontece durante TODO o tempo em
 *   que a moldura está visível (do primeiro ao último pixel na tela).
 *
 * scrub: true + ease: "none"
 *   Parallax precisa ser proporcional ao scroll (velocidade constante), então
 *   usamos vínculo direto e ease linear.
 *
 * Docs: https://gsap.com/docs/v3/GSAP/CorePlugins/CSS (yPercent)
 *       https://gsap.com/docs/v3/Plugins/ScrollTrigger/
 */
import { gsap } from "gsap";
import { DEBUG_SCROLL } from "../../config/debug";
import { MEDIA, type MediaConditions } from "../../lib/media";

/* ---------------------------------------------------------------------------
 * PARÂMETROS
 * ------------------------------------------------------------------------- */
export type ParallaxParams = {
  /** deslocamento em % da altura da própria imagem (0–100) */
  intensity: number;
  /** "up" = yPercent negativo (primeiro plano) · "down" = positivo (fundo) */
  direction: "up" | "down";
  /** aumenta a altura da imagem para nunca aparecer buraco */
  compensate: boolean;
  scrub: boolean | number;
  start: string;
  end: string;
  markers: boolean;
};

export const PARALLAX_DEFAULTS: ParallaxParams = {
  intensity: 20,
  direction: "up",
  compensate: true,
  scrub: true,
  start: "top bottom",
  end: "bottom top",
  markers: DEBUG_SCROLL,
};

/** Altura máxima da imagem (em alturas da moldura) quando compensamos */
const MAX_HEIGHT_RATIO = 4;

export type ParallaxGeometry = {
  /** altura da imagem ÷ altura da moldura */
  heightRatio: number;
  yPercent: number;
  /** posição do topo da imagem (em alturas da moldura; 0 = topo da moldura) */
  topStart: number;
  topEnd: number;
  /** quanto da moldura fica descoberto no fim (0–1) */
  gapEnd: number;
};

/** A matemática do comentário lá em cima, em código */
export function parallaxGeometry(intensity: number, direction: "up" | "down", compensate: boolean): ParallaxGeometry {
  const p = intensity / 100;
  const heightRatio = compensate ? Math.min(1 / Math.max(1 - p, 1e-6), MAX_HEIGHT_RATIO) : 1;
  const yPercent = direction === "up" ? -intensity : intensity;
  // "up": ancorada no topo. "down": ancorada na base (sobra fica para cima).
  const topStart = direction === "up" ? 0 : 1 - heightRatio;
  const topEnd = topStart + (yPercent / 100) * heightRatio;
  const gapEnd = direction === "up" ? Math.max(0, 1 - (topEnd + heightRatio)) : Math.max(0, topEnd);
  return { heightRatio, yPercent, topStart, topEnd, gapEnd };
}

export type ParallaxElements = {
  /** moldura com overflow: hidden — é o trigger e NÃO é animada */
  frame: HTMLElement;
  image: HTMLElement;
};

export type ParallaxHooks = {
  onGeometry?: (geometry: ParallaxGeometry, effectiveIntensity: number) => void;
  onUpdate?: (progress: number, yPercent: number) => void;
};

export function createImageParallax(el: ParallaxElements, params: ParallaxParams, hooks: ParallaxHooks = {}) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { isMobile, reduceMotion } = context.conditions as MediaConditions;
    if (reduceMotion) return; // imagem parada, altura 100% (CSS)

    // Mobile: 60% da intensidade. Telas pequenas + rolagem por toque (com
    // inércia) deixam parallax forte enjoativo, e uma imagem 2× mais alta que
    // a moldura precisa ser muito ampliada para cobrir a largura.
    const intensity = isMobile ? params.intensity * 0.6 : params.intensity;
    const geo = parallaxGeometry(intensity, params.direction, params.compensate);

    // LAYOUT (não é animação): altura e âncora da imagem.
    // gsap.set() dentro do matchMedia também é revertido automaticamente.
    gsap.set(el.image, {
      height: `${geo.heightRatio * 100}%`,
      top: params.direction === "up" ? "0%" : "auto",
      bottom: params.direction === "up" ? "auto" : "0%",
    });

    // ANIMAÇÃO: só transform (yPercent) → barato, sem recalcular layout
    gsap.fromTo(
      el.image,
      { yPercent: 0 },
      {
        yPercent: geo.yPercent,
        ease: "none",
        scrollTrigger: {
          id: "05-parallax",
          trigger: el.frame,
          start: params.start,
          end: params.end,
          scrub: params.scrub,
          markers: params.markers,
          onUpdate: (self) => hooks.onUpdate?.(self.progress, Number(gsap.getProperty(el.image, "yPercent"))),
        },
      },
    );

    hooks.onGeometry?.(geo, intensity);
  });

  return mm;
}
