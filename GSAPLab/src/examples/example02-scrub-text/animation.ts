/**
 * ============================================================================
 * EXEMPLO 02 — TEXTO SCRUBBED
 * ============================================================================
 *
 * CONCEITO PRINCIPAL: scrub
 *   Toda animação GSAP tem um PLAYHEAD — a "agulha" que diz em que ponto da
 *   animação estamos (progress 0 = início, 1 = fim). Normalmente o playhead
 *   anda sozinho com o tempo (duration). Com `scrub`, quem move o playhead é
 *   a BARRA DE ROLAGEM:
 *
 *     scroll no start ───────────────► scroll no end
 *     progress 0      ───────────────► progress 1
 *
 *   Rolou 30% da distância entre start e end → a animação está em 30%.
 *   Parou de rolar → a animação para. Rolou para cima → ela volta.
 *
 * AS 4 VARIAÇÕES
 *   scrub: false → sem vínculo. O scroll só DISPARA (como no exemplo 01) e
 *                  a animação toca com a própria duration (toggleActions).
 *   scrub: true  → vínculo DIRETO: o playhead pula exatamente para a posição
 *                  do scroll a cada frame. Resposta instantânea (e "seca").
 *   scrub: 0.5   → vínculo SUAVIZADO: o playhead leva 0.5s para ALCANÇAR a
 *                  posição do scroll. Parece ter "inércia".
 *   scrub: 1     → idem, levando 1s. Quanto maior o número, mais "atraso" e
 *                  mais suave (e menos preciso) fica.
 *   No HUD da página você vê as duas coisas: o progress do ScrollTrigger (a
 *   posição do scroll) e o progress do tween (o playhead). Com scrub numérico,
 *   a segunda barra "persegue" a primeira.
 *
 * duration COM scrub
 *   Com scrub, a duração de UM tween isolado não importa: a animação inteira é
 *   "esticada" para caber entre start e end. Para deixá-la mais longa, aumente
 *   a DISTÂNCIA de scroll (ex.: end: "+=2000"), não a duration.
 *   (Em timelines a duration importa como PROPORÇÃO entre tweens — ex. 08.)
 *
 * ease COM scrub
 *   Geralmente usamos ease: "none" (linear): 10% de scroll = 10% de movimento.
 *   Com outra ease, a relação deixa de ser linear (ex.: power2.out anda muito
 *   no começo do trecho e pouco no final). Teste no painel.
 *
 * start / end
 *   start: "top bottom" → quando o TOPO do trigger encosta na BASE da viewport
 *                         (ou seja: assim que ele começa a aparecer)
 *   end:   "bottom top" → quando a BASE do trigger encosta no TOPO da viewport
 *                         (ou seja: quando ele acabou de sair por cima)
 *   Resultado: a animação acontece durante TODO o tempo em que o elemento
 *   está visível.
 *
 * gsap.fromTo()
 *   Usamos fromTo porque definimos explicitamente os DOIS extremos
 *   (x: -300 → x: 300). Nem o estado inicial nem o final são o do CSS.
 *
 * Docs: https://gsap.com/docs/v3/Plugins/ScrollTrigger/ (scrub)
 *       https://gsap.com/docs/v3/GSAP/gsap.fromTo()
 */
import { gsap } from "gsap";
import { DEBUG_SCROLL } from "../../config/debug";
import { MEDIA, type MediaConditions } from "../../lib/media";

/* ---------------------------------------------------------------------------
 * PARÂMETROS
 * ------------------------------------------------------------------------- */
export type ScrubMode = "false" | "true" | "number";

export type ScrubTextParams = {
  /** "false" | "true" | "number" (usa scrubAmount) */
  scrubMode: ScrubMode;
  /** segundos para o playhead alcançar o scroll (quando scrubMode = "number") */
  scrubAmount: number;
  fromX: number;
  toX: number;
  ease: string;
  /** só faz diferença com scrub: false */
  duration: number;
  start: string;
  end: string;
  markers: boolean;
};

export const SCRUB_TEXT_DEFAULTS: ScrubTextParams = {
  scrubMode: "true",
  scrubAmount: 1,
  fromX: -300,
  toX: 300,
  ease: "none",
  duration: 1,
  start: "top bottom",
  end: "bottom top",
  markers: DEBUG_SCROLL,
};

/** Converte o modo escolhido no valor real aceito por `scrub` */
export function resolveScrub(p: ScrubTextParams): boolean | number {
  if (p.scrubMode === "false") return false;
  if (p.scrubMode === "true") return true;
  return p.scrubAmount;
}

export type ScrubTextElements = {
  /** área que o ScrollTrigger mede (não anima) */
  trigger: HTMLElement;
  /** a linha de texto que se move em x */
  line: HTMLElement;
};

export type ScrubTextHooks = {
  /** progress do ScrollTrigger = posição do scroll entre start e end */
  onScroll?: (progress: number, direction: number) => void;
  /** progress do tween = posição do playhead da animação */
  onPlayhead?: (progress: number, x: number) => void;
};

export function createScrubText(el: ScrubTextElements, params: ScrubTextParams, hooks: ScrubTextHooks = {}) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { isMobile, reduceMotion } = context.conditions as MediaConditions;

    if (reduceMotion) return; // texto parado, no lugar definido pelo CSS

    // 300px numa tela de 1440px ≈ 20% da largura; numa tela de 390px ≈ 77%.
    // No mobile usamos metade da distância para manter a proporção visual.
    const factor = isMobile ? 0.5 : 1;
    const scrub = resolveScrub(params);

    gsap.fromTo(
      el.line,
      { x: params.fromX * factor }, // estado inicial (progress 0)
      {
        x: params.toX * factor, // estado final (progress 1)
        ease: params.ease,
        duration: params.duration,

        // callback do TWEEN: roda sempre que o playhead renderiza — inclusive
        // enquanto o scrub numérico ainda está "alcançando" o scroll.
        // Dentro dos callbacks do GSAP, `this` é a própria animação. Usamos
        // `function` (e não arrow + variável) porque o fromTo renderiza o
        // estado inicial JÁ NA CRIAÇÃO (immediateRender), antes de qualquer
        // `const tween = ...` receber o valor.
        onUpdate: function (this: gsap.core.Tween) {
          hooks.onPlayhead?.(this.progress(), Number(gsap.getProperty(el.line, "x")));
        },

        scrollTrigger: {
          id: "02-scrub-text",
          trigger: el.trigger,
          start: params.start,
          end: params.end,
          scrub, // false | true | número
          // toggleActions só vale quando scrub é false (com scrub, é ignorado)
          toggleActions: "play reverse play reverse",
          markers: params.markers,

          // callback do SCROLLTRIGGER: roda quando a posição do scroll muda
          onUpdate: (self) => hooks.onScroll?.(self.progress, self.direction),
        },
      },
    );
  });

  return mm;
}
