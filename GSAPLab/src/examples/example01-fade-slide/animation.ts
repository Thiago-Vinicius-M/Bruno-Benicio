/**
 * ============================================================================
 * EXEMPLO 01 — FADE + SLIDE
 * ============================================================================
 *
 * CONCEITO PRINCIPAL
 *   O scroll apenas DISPARA a animação. Depois de disparada, ela toca sozinha
 *   com a sua própria `duration` e `ease` — não fica presa à barra de rolagem
 *   (isso seria `scrub`, visto no exemplo 02).
 *
 * O QUE ACONTECE
 *   O conteúdo começa `y` pixels abaixo e invisível (opacity 0) e anima até
 *   o seu estado natural definido pelo CSS (y: 0, opacity: 1).
 *
 * POR QUE gsap.from()?
 *   `gsap.from(alvo, { y: 100, opacity: 0 })` significa:
 *   "anime A PARTIR destes valores ATÉ os valores atuais do elemento".
 *   O estado final é o que o CSS já define — ótimo para "entradas", porque se
 *   o JavaScript falhar (ou movimento reduzido estiver ativo) o conteúdo
 *   continua visível e no lugar certo.
 *   Detalhe: from() tem `immediateRender: true` por padrão, então o estado
 *   inicial (y: 100, opacity: 0) é aplicado NA HORA em que o tween é criado,
 *   mesmo que o ScrollTrigger ainda não tenha disparado. É isso que evita o
 *   "flash" do conteúdo visível antes da animação.
 *
 * TRIGGER vs ALVO
 *   - trigger: o bloco externo (NÃO anima). O ScrollTrigger mede a posição
 *     dele para saber onde ficam `start` e `end`.
 *   - alvo: o conteúdo interno (anima). Se medíssemos o próprio elemento que
 *     se desloca 100px, estaríamos medindo uma posição "deslocada".
 *
 * start / end
 *   start: "top 80%"   → quando o TOPO do trigger encostar na linha de 80% da
 *                         altura da viewport (medida a partir do topo da tela)
 *   end:   "bottom 20%" → quando a BASE do trigger encostar na linha de 20%
 *   Com toggleActions (sem scrub), `end` não define duração nenhuma: ele só
 *   marca onde disparam onLeave (descendo) e onEnterBack (subindo).
 *
 * toggleActions: "onEnter onLeave onEnterBack onLeaveBack"
 *   4 posições, uma para cada momento em que o scroll cruza start/end:
 *     onEnter     → cruzou o start descendo
 *     onLeave     → cruzou o end descendo
 *     onEnterBack → cruzou o end subindo (voltou para dentro)
 *     onLeaveBack → cruzou o start subindo (saiu por cima)
 *   Valores: play | pause | resume | reset | restart | complete | reverse | none
 *   Padrão: "play none none none" (toca uma vez e pronto).
 *
 * VELOCIDADE
 *   GSAP não tem "velocidade": você controla `y` (distância) e `duration`
 *   (tempo). Velocidade média = y / duration. 100px em 1s = 100px/s;
 *   200px em 0.5s = 400px/s. A `ease` redistribui essa velocidade no tempo
 *   (power2.out = rápido no começo, desacelera no fim).
 *
 * Docs: https://gsap.com/docs/v3/GSAP/gsap.from()
 *       https://gsap.com/docs/v3/Plugins/ScrollTrigger/
 */
import { gsap } from "gsap";
import { DEBUG_SCROLL } from "../../config/debug";
import { MEDIA, type MediaConditions } from "../../lib/media";

/* ---------------------------------------------------------------------------
 * PARÂMETROS — altere os valores padrão aqui (ou pelo painel na página)
 * ------------------------------------------------------------------------- */
export type FadeSlideParams = {
  /** distância inicial em px (de onde o conteúdo "vem") */
  y: number;
  /** duração em segundos (o scroll não controla o tempo aqui) */
  duration: number;
  ease: string;
  start: string;
  end: string;
  toggleActions: string;
  markers: boolean;
};

export const FADE_SLIDE_DEFAULTS: FadeSlideParams = {
  y: 100,
  duration: 1,
  ease: "power2.out",
  start: "top 80%",
  end: "bottom 20%",
  toggleActions: "play none none reverse",
  markers: DEBUG_SCROLL,
};

export type FadeSlideElements = {
  /** bloco que o ScrollTrigger mede (não anima) */
  trigger: HTMLElement;
  /** conteúdo que anima */
  content: HTMLElement;
};

export type ToggleCallbackName = "onEnter" | "onLeave" | "onEnterBack" | "onLeaveBack";

export type FadeSlideHooks = {
  /** chamado nos 4 callbacks, junto com a ação do toggleActions correspondente */
  onEvent?: (name: ToggleCallbackName, action: string) => void;
};

export function createFadeSlide(el: FadeSlideElements, params: FadeSlideParams, hooks: FadeSlideHooks = {}) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { isMobile, reduceMotion } = context.conditions as MediaConditions;

    if (reduceMotion) {
      // Movimento reduzido: nenhum tween é criado. O conteúdo fica exatamente
      // como o CSS define (visível e no lugar) — nada fica escondido.
      return;
    }

    // Em telas pequenas, 100px representam uma fração MUITO maior da tela.
    // Reduzimos a distância para o movimento ter o mesmo "peso" visual.
    const distance = isMobile ? params.y * 0.6 : params.y;

    // Ações na mesma ordem dos callbacks: "onEnter onLeave onEnterBack onLeaveBack"
    const [enter, leave, enterBack, leaveBack] = params.toggleActions.split(" ");

    gsap.from(el.content, {
      // ---- estado INICIAL (from) — o final é o estado natural do CSS ----
      y: distance,
      opacity: 0,

      // ---- como a animação toca depois de disparada ----
      duration: params.duration,
      ease: params.ease,

      // ---- quando ela é disparada ----
      scrollTrigger: {
        id: "01-fade-slide", // aparece no texto dos markers
        trigger: el.trigger,
        start: params.start,
        end: params.end,
        toggleActions: params.toggleActions,
        markers: params.markers,

        // Callbacks: aqui apenas registramos no log da página qual ação do
        // toggleActions foi executada em cada momento.
        onEnter: () => hooks.onEvent?.("onEnter", enter),
        onLeave: () => hooks.onEvent?.("onLeave", leave),
        onEnterBack: () => hooks.onEvent?.("onEnterBack", enterBack),
        onLeaveBack: () => hooks.onEvent?.("onLeaveBack", leaveBack),
      },
    });
  });

  // Quem chamou (o componente React) é responsável por mm.revert() no cleanup.
  return mm;
}
