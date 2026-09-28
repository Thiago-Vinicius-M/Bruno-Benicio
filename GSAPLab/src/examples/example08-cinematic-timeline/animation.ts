/**
 * ============================================================================
 * EXEMPLO 08 — TIMELINE CINEMATIC
 * ============================================================================
 *
 * POR QUE TIMELINE?
 *   Com vários tweens soltos, cada um precisaria do seu próprio delay e do
 *   seu próprio ScrollTrigger — e mudar a duração de um passo obrigaria a
 *   recalcular os delays de todos os seguintes. Uma timeline é um "trilho"
 *   onde os tweens são posicionados RELATIVAMENTE uns aos outros:
 *     - UM ScrollTrigger controla a sequência inteira
 *     - mudou a duração do passo 2? os seguintes se ajustam sozinhos
 *     - dá para sobrepor, espaçar e alinhar passos com o position parameter
 *
 *   gsap.to(el, {...})        → tween solto: dos valores ATUAIS para os dados
 *   gsap.from(el, {...})      → tween solto: DOS dados para os valores atuais
 *   gsap.fromTo(el, {a}, {b}) → tween solto: de A para B (explícito)
 *   gsap.timeline()           → container: tl.to() / tl.from() / tl.fromTo()
 *                               adicionam tweens NELE, em sequência
 *
 * POSITION PARAMETER (o 3º/4º argumento de tl.to/from/fromTo)
 *   (omitido) → no FIM da timeline (padrão: "+=0"). Um depois do outro.
 *   ">"       → no fim do tween ADICIONADO POR ÚLTIMO
 *   "<"       → no INÍCIO do tween adicionado por último (juntos)
 *   "+=1"     → 1s DEPOIS do fim da timeline (cria uma pausa)
 *   "-=0.5"   → 0.5s ANTES do fim da timeline (sobreposição)
 *   "<0.5"    → 0.5s depois do INÍCIO do anterior
 *   ">-0.25"  → 0.25s antes do FIM do anterior
 *   2         → exatamente em 2s (tempo absoluto)
 *   "rótulo"  → na posição de um label (visto no exemplo 10)
 *
 *   A régua da página desenha cada tween (início e duração) — mude as
 *   posições no painel e veja as barras se moverem/sobreporem.
 *
 * DURAÇÃO RELATIVA (com scrub)
 *   Com scrub, a timeline inteira é esticada entre start e end. As durations
 *   deixam de ser "segundos" e viram PROPORÇÕES: se a timeline tem 6s e o
 *   pin dura 3600px, cada "segundo" de timeline = 600px de scroll. Um tween
 *   de duration 1.5 ocupa 900px.
 *
 * SOBREPOSIÇÃO NA MESMA PROPRIEDADE = CONFLITO
 *   Se dois tweens animam a MESMA propriedade do MESMO elemento ao mesmo
 *   tempo (ex.: scale da imagem nos passos 3 e 6 sobrepostos), eles brigam
 *   e o resultado "pula". Sobreponha tweens de propriedades/elementos
 *   diferentes (ex.: imagem aumenta enquanto o texto sobe — passos 3 e 4).
 *
 * Docs: https://gsap.com/docs/v3/GSAP/Timeline
 *       https://gsap.com/resources/position-parameter/
 */
import { gsap } from "gsap";
import { DEBUG_SCROLL } from "../../config/debug";
import { MEDIA, type MediaConditions } from "../../lib/media";

/* ---------------------------------------------------------------------------
 * PARÂMETROS
 * ------------------------------------------------------------------------- */
export type CinematicParams = {
  /** position parameter de cada passo (o passo 1 começa em 0) */
  pos2: string;
  pos3: string;
  pos4: string;
  pos5: string;
  pos6: string;
  /** ease padrão de todos os tweens (via `defaults`) */
  ease: string;
  /** duração do pin em alturas de tela */
  screens: number;
  scrub: boolean | number;
  markers: boolean;
};

export const CINEMATIC_DEFAULTS: CinematicParams = {
  pos2: ">",
  pos3: ">",
  pos4: "<",
  pos5: "-=0.5",
  pos6: "+=1",
  ease: "power2.inOut",
  screens: 4,
  scrub: 1,
  markers: DEBUG_SCROLL,
};

export const STEP_LABELS = [
  "1 · texto entra — .from()",
  "2 · imagem aparece — .fromTo()",
  "3 · imagem aumenta — .to()",
  "4 · texto muda de posição — .to()",
  "5 · legenda aparece — .fromTo()",
  "6 · imagem reduz — .to()",
];

export type CinematicElements = {
  /** seção de 100vh: trigger + pin (não animada) */
  stage: HTMLElement;
  title: HTMLElement;
  media: HTMLElement;
  caption: HTMLElement;
};

export type TimelineSegment = { label: string; start: number; duration: number };

export type CinematicHooks = {
  onBuilt?: (segments: TimelineSegment[], totalDuration: number) => void;
  onTime?: (time: number, duration: number) => void;
  onProgress?: (progress: number) => void;
};

export function createCinematicTimeline(el: CinematicElements, params: CinematicParams, hooks: CinematicHooks = {}) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { isMobile, reduceMotion } = context.conditions as MediaConditions;
    if (reduceMotion) return; // composição estática (CSS)

    // Estado inicial da imagem ANTES da sequência (não faz parte da timeline).
    gsap.set(el.media, { scale: 0.7 });

    const tl = gsap.timeline({
      // `defaults`: herdado por todos os tweens desta timeline
      defaults: { ease: params.ease, duration: 1 },
      // callback da timeline: roda a cada render (inclusive durante o scrub).
      // `this` = a própria timeline (seguro mesmo se disparar na criação).
      onUpdate: function (this: gsap.core.Timeline) {
        hooks.onTime?.(this.time(), this.duration());
      },
      scrollTrigger: {
        id: "08-cinematic",
        trigger: el.stage,
        pin: true,
        start: "top top",
        end: () => `+=${window.innerHeight * params.screens}`,
        scrub: params.scrub,
        invalidateOnRefresh: true, // recalcula o `y` baseado na altura da tela
        anticipatePin: 1,
        markers: params.markers,
        onUpdate: (self) => hooks.onProgress?.(self.progress),
      },
    });

    tl
      // 1 · texto entra (sem position → começa em 0, timeline vazia)
      .from(el.title, { yPercent: 60, autoAlpha: 0, duration: 1 })

      // 2 · imagem aparece: o recorte abre e ela surge
      .fromTo(
        el.media,
        { autoAlpha: 0, clipPath: "inset(18% 18% 18% 18% round 24px)" },
        { autoAlpha: 1, clipPath: "inset(0% 0% 0% 0% round 24px)" },
        params.pos2,
      )

      // 3 · imagem aumenta (0.7 → 1). duration 1.5 = passo mais "longo"
      .to(el.media, { scale: 1, duration: 1.5 }, params.pos3)

      // 4 · texto sobe e diminui. `y` é uma FUNÇÃO: recalculada no refresh
      .to(
        el.title,
        { y: () => -el.stage.clientHeight * (isMobile ? 0.34 : 0.36), scale: isMobile ? 0.6 : 0.42 },
        params.pos4,
      )

      // 5 · outro elemento (legenda) aparece
      .fromTo(el.caption, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.8 }, params.pos5)

      // 6 · imagem reduz e abre espaço para a legenda
      .to(
        el.media,
        isMobile ? { scale: 0.78, yPercent: -12 } : { scale: 0.58, xPercent: -20 },
        params.pos6,
      );

    // Lê a posição REAL de cada tween na timeline (para desenhar a régua)
    const segments = tl.getChildren(false, true, false).map((child, i) => ({
      label: STEP_LABELS[i] ?? `tween ${i + 1}`,
      start: child.startTime(),
      duration: child.duration(),
    }));
    hooks.onBuilt?.(segments, tl.duration());
  });

  return mm;
}
