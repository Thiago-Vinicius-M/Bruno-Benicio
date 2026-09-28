/**
 * ============================================================================
 * EXEMPLO 09 — PIN + MOVIMENTO HORIZONTAL
 * ============================================================================
 *
 * CONCEITO
 *   A seção é pinada (fica parada na tela). Enquanto você rola para BAIXO,
 *   uma timeline com scrub move a fileira de cards para a ESQUERDA. O scroll
 *   continua vertical e nativo (sem scroll-jacking): só a representação
 *   visual é horizontal.
 *
 * POR QUE A DISTÂNCIA PRECISA SER CALCULADA
 *
 *   ┌──────── viewport (clientWidth) ───────┐
 *   │ [intro] [card 01] [card 02]│[card 03]  ← a fileira é mais larga que a tela
 *   └───────────────────────────────────────┘
 *   ├──────────── track.scrollWidth ─────────────────┤
 *
 *   Para o ÚLTIMO pixel da fileira encostar na borda direita da tela, a
 *   fileira precisa andar exatamente:
 *
 *       distância = track.scrollWidth − section.clientWidth
 *
 *   - scrollWidth: largura TOTAL do conteúdo (inclui o que está fora da tela)
 *   - clientWidth: largura VISÍVEL do elemento (sem a barra de rolagem —
 *     por isso é melhor que window.innerWidth, que inclui a barra vertical)
 *   - offsetWidth: largura da caixa incluindo bordas (não inclui o conteúdo
 *     que transborda) — não serve para "quanto falta"
 *
 *   Se andar menos, o último card fica cortado; se andar mais, sobra um
 *   vazio à direita. Esse número muda com a largura da tela (cards em vw,
 *   gaps, fonte...), então NUNCA deve ser fixo no código.
 *
 * END DINÂMICO
 *   end: () => "+=" + distância × speed
 *   speed 1 → 1px de scroll vertical = 1px de movimento horizontal (natural)
 *   speed 2 → o dobro de scroll para o mesmo movimento (mais lento)
 *   Como é uma FUNÇÃO, é recalculado a cada ScrollTrigger.refresh() (resize,
 *   rotação do celular, fontes carregando...).
 *
 * invalidateOnRefresh: true
 *   O `x: () => -distância` também é função, mas o GSAP guarda o valor
 *   calculado na primeira vez. invalidateOnRefresh faz a timeline descartar
 *   esses valores gravados e chamar as funções de novo em cada refresh.
 *
 * O MODO "xPercent" (ingênuo)
 *   O exemplo clássico da documentação anima cada painel com
 *   xPercent: -100 × (n − 1). xPercent é relativo à largura do PRÓPRIO
 *   elemento, então isso só funciona quando TODOS os painéis têm 100% da
 *   largura da tela e não há gaps/padding. Aqui o painel de introdução é
 *   mais estreito que os cards e há espaçamento → ative o modo no painel:
 *   cada painel anda uma distância diferente, eles se desencontram e o
 *   último card para no lugar errado. Medir é mais robusto do que supor.
 *
 * RESPONSIVIDADE
 *   - A largura dos cards muda por CSS (mobile 84vw). O JS não sabe nem
 *     precisa saber: ele MEDE no refresh.
 *   - ScrollTrigger dá refresh sozinho no resize (com debounce).
 *   - Em celulares, a barra de endereço aparecendo/sumindo muda a altura da
 *     viewport e dispararia um refresh no meio do scroll. Este projeto liga
 *     ScrollTrigger.config({ ignoreMobileResize: true }) em lib/gsapSetup.ts
 *     (o padrão da opção é false) para ignorar esses resizes verticais em
 *     dispositivos touch.
 *   - Movimento reduzido: sem pin; a fileira vira um scroll horizontal
 *     nativo com scroll-snap (CSS).
 *
 * Docs: https://gsap.com/docs/v3/Plugins/ScrollTrigger/ (pin, invalidateOnRefresh)
 */
import { gsap } from "gsap";
import { DEBUG_SCROLL } from "../../config/debug";
import { MEDIA, type MediaConditions } from "../../lib/media";

/* ---------------------------------------------------------------------------
 * PARÂMETROS
 * ------------------------------------------------------------------------- */
export type HorizontalParams = {
  mode: "measured" | "xPercent";
  /** px de scroll vertical por px de movimento horizontal */
  speed: number;
  scrub: boolean | number;
  markers: boolean;
};

export const HORIZONTAL_DEFAULTS: HorizontalParams = {
  mode: "measured",
  speed: 1,
  scrub: 1,
  markers: DEBUG_SCROLL,
};

export type HorizontalElements = {
  /** seção de 100vh: trigger + pin (não animada) */
  section: HTMLElement;
  /** fileira flex que contém os painéis (animada no modo "measured") */
  track: HTMLElement;
  /** painéis individuais (animados no modo "xPercent") */
  panels: HTMLElement[];
  /** barra de progresso (scaleX 0 → 1) */
  progressBar: HTMLElement;
};

export type Measurements = { scrollWidth: number; clientWidth: number; distance: number; scrollDistance: number };

export type HorizontalHooks = {
  onMeasure?: (m: Measurements) => void;
  onProgress?: (progress: number) => void;
};

/** A conta central do exemplo */
export function getDistance(el: HorizontalElements) {
  return Math.max(0, el.track.scrollWidth - el.section.clientWidth);
}

export function createHorizontalPin(el: HorizontalElements, params: HorizontalParams, hooks: HorizontalHooks = {}) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { reduceMotion } = context.conditions as MediaConditions;
    if (reduceMotion) return; // CSS: scroll horizontal nativo com scroll-snap

    const tl = gsap.timeline({
      defaults: { ease: "none" }, // movimento proporcional ao scroll
      scrollTrigger: {
        id: "09-horizontal",
        trigger: el.section,
        pin: true,
        start: "top top",
        end: () => `+=${getDistance(el) * params.speed}`, // END DINÂMICO
        scrub: params.scrub,
        invalidateOnRefresh: true, // reavalia as funções no refresh
        anticipatePin: 1,
        markers: params.markers,
        onUpdate: (self) => hooks.onProgress?.(self.progress),
        onRefresh: (self) =>
          hooks.onMeasure?.({
            scrollWidth: el.track.scrollWidth,
            clientWidth: el.section.clientWidth,
            distance: getDistance(el),
            scrollDistance: self.end - self.start,
          }),
      },
    });

    if (params.mode === "measured") {
      // ✔ move a fileira inteira exatamente a distância medida
      tl.to(el.track, { x: () => -getDistance(el) }, 0);
    } else {
      // ✘ suposição: "cada painel tem 100% da largura da tela"
      tl.to(el.panels, { xPercent: -100 * (el.panels.length - 1) }, 0);
    }

    // Na MESMA posição (0), a barra de progresso enche junto com o movimento
    tl.fromTo(el.progressBar, { scaleX: 0 }, { scaleX: 1 }, 0);
  });

  return mm;
}
