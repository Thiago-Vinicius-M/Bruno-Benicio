/**
 * ============================================================================
 * EXEMPLO 04 — IMAGEM REVEAL / CLIP
 * ============================================================================
 *
 * CONCEITO PRINCIPAL: GSAP anima propriedades CSS — inclusive strings complexas
 *   A imagem começa "recortada" por um clip-path e o recorte abre enquanto
 *   você rola. Ao mesmo tempo a imagem interna diminui de escala (1.4 → 1),
 *   o que dá a sensação de "câmera se afastando" dentro da moldura.
 *
 * QUEM FAZ O QUÊ (CSS × GSAP)
 *   CSS (estático, no styles.css):
 *     - aspect-ratio da moldura      → reserva o espaço (sem layout shift)
 *     - overflow: hidden             → a imagem em scale 1.4 não "vaza"
 *     - object-fit: cover            → a foto preenche a moldura sem distorcer
 *     - border-radius, cores, fontes
 *   GSAP (animado, aqui):
 *     - clipPath       → é uma propriedade CSS (clip-path), mas quem a
 *                        interpola é o GSAP. Ele lê os NÚMEROS dentro da string
 *                        e anima cada um:
 *                          "inset(30% 30% 30% 30% round 40px)"
 *                        → "inset(0% 0% 0% 0% round 0px)"
 *                        Por isso as duas strings precisam ter o MESMO formato
 *                        (mesma função, mesma quantidade de números, mesmas
 *                        unidades). inset → circle não interpola.
 *     - scale          → atalho do GSAP para transform: scale(...)
 *     - transformOrigin → atalho para transform-origin: define o ponto "fixo"
 *                        da escala ("center center", "top center"...)
 *     - opacity / y    → da legenda
 *
 * PERFORMANCE
 *   transform (scale) e opacity são as propriedades mais baratas de animar:
 *   não recalculam layout. clip-path também não mexe no layout (só no que é
 *   pintado), então é seguro — diferente de animar width/height/top/left.
 *
 * TIMELINE + SCRUB
 *   Duas propriedades em dois elementos precisam andar JUNTAS e ligadas ao
 *   scroll → uma timeline com UM ScrollTrigger (scrub), e os dois tweens na
 *   posição 0 (começam ao mesmo tempo). Timelines são detalhadas no ex. 08.
 *
 * start / end
 *   start: "top 90%"  → topo da moldura encosta a 90% da altura da viewport
 *                       (a imagem acabou de aparecer embaixo)
 *   end:   "top 20%"  → topo da moldura chega perto do topo da tela
 *   Distância de scroll = 70% da altura da viewport. Diminua o intervalo
 *   (ex.: end "top 60%") e o reveal fica mais "rápido" para o mesmo scroll.
 *
 * Docs: https://gsap.com/docs/v3/GSAP/CorePlugins/CSS
 *       https://gsap.com/docs/v3/Plugins/ScrollTrigger/
 */
import { gsap } from "gsap";
import { DEBUG_SCROLL } from "../../config/debug";
import { MEDIA, type MediaConditions } from "../../lib/media";

/* ---------------------------------------------------------------------------
 * PARÂMETROS
 * ------------------------------------------------------------------------- */
export type RevealShape = "center" | "bottom" | "left" | "circle";

export type ImageRevealParams = {
  shape: RevealShape;
  /** quanto da imagem começa escondido (0–100%) */
  hidden: number;
  /** arredondamento inicial do recorte (px) — só para inset() */
  radius: number;
  scaleFrom: number;
  transformOrigin: string;
  scrub: boolean | number;
  start: string;
  end: string;
  markers: boolean;
};

export const IMAGE_REVEAL_DEFAULTS: ImageRevealParams = {
  shape: "center",
  hidden: 60,
  radius: 40,
  scaleFrom: 1.4,
  transformOrigin: "center center",
  scrub: true,
  start: "top 90%",
  end: "top 20%",
  markers: DEBUG_SCROLL,
};

/**
 * Strings de clip-path. Note que "de" e "para" têm SEMPRE o mesmo formato —
 * é isso que permite ao GSAP interpolar número a número.
 */
export function clipPaths(p: ImageRevealParams): { from: string; to: string } {
  const h = p.hidden;
  switch (p.shape) {
    case "center": // fecha igualmente pelos 4 lados
      return {
        from: `inset(${h / 2}% ${h / 2}% ${h / 2}% ${h / 2}% round ${p.radius}px)`,
        to: "inset(0% 0% 0% 0% round 0px)",
      };
    case "bottom": // começa cortado em cima → revela de baixo para cima
      return { from: `inset(${h}% 0% 0% 0% round ${p.radius}px)`, to: "inset(0% 0% 0% 0% round 0px)" };
    case "left": // começa cortado à direita → revela da esquerda para a direita
      return { from: `inset(0% ${h}% 0% 0% round ${p.radius}px)`, to: "inset(0% 0% 0% 0% round 0px)" };
    case "circle": // raio 75% cobre qualquer retângulo inteiro
      return { from: `circle(${(75 * (100 - h)) / 100}% at 50% 50%)`, to: "circle(75% at 50% 50%)" };
  }
}

export type ImageRevealElements = {
  /** figura externa: é o trigger e NÃO é animada */
  figure: HTMLElement;
  /** moldura que recebe o clip-path */
  clip: HTMLElement;
  /** a imagem que recebe o scale */
  image: HTMLElement;
  caption: HTMLElement;
};

export type ImageRevealHooks = {
  onUpdate?: (progress: number, clipPath: string, scale: number) => void;
};

export function createImageReveal(el: ImageRevealElements, params: ImageRevealParams, hooks: ImageRevealHooks = {}) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { reduceMotion } = context.conditions as MediaConditions;
    if (reduceMotion) return; // imagem inteira, sem recorte

    // Mobile: nada muda aqui no JS! A moldura fica mais "em pé" via CSS
    // (aspect-ratio 4/5) e os percentuais de start/end se adaptam sozinhos à
    // altura da tela. Nem toda diferença de tela precisa de matchMedia.

    const clip = clipPaths(params);

    const tl = gsap.timeline({
      defaults: { ease: "none", duration: 1 }, // com scrub, "none" = linear
      scrollTrigger: {
        id: "04-image-reveal",
        trigger: el.figure,
        start: params.start,
        end: params.end,
        scrub: params.scrub,
        markers: params.markers,
        onUpdate: (self) =>
          hooks.onUpdate?.(self.progress, el.clip.style.clipPath, Number(gsap.getProperty(el.image, "scale"))),
      },
    });

    tl
      // 1) o recorte abre (clip-path na MOLDURA)
      .fromTo(el.clip, { clipPath: clip.from }, { clipPath: clip.to }, 0)
      // 2) ao mesmo tempo (posição 0), a imagem "afasta" (scale na IMAGEM)
      .fromTo(el.image, { scale: params.scaleFrom, transformOrigin: params.transformOrigin }, { scale: 1 }, 0)
      // 3) nos últimos 40% da timeline, a legenda aparece
      .fromTo(el.caption, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4 }, 0.6);
  });

  return mm;
}
