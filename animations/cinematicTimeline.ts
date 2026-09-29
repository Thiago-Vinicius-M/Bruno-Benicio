/**
 * Timeline cinematic — vários passos numa única gsap.timeline() controlada por UM
 * ScrollTrigger com pin e scrub.
 *
 * Por que timeline? Os tweens são posicionados RELATIVAMENTE uns aos outros (position
 * parameter): mudar a duração de um passo reposiciona os seguintes sozinho, e um único
 * ScrollTrigger controla a sequência inteira.
 *
 * Com scrub, as durations viram PROPORÇÕES: a timeline é esticada entre start e end.
 * Se ela tem 5 "segundos" e o pin dura 2500px de scroll, cada segundo = 500px.
 *
 * Passos:
 *   1 · texto entra, centralizado na área visível
 *   2 · mídia aparece atrás do texto (recorte abre)
 *   3 · mídia aumenta
 *   4 · texto volta para a posição do layout (acima da mídia)
 *   5 · legenda aparece
 *
 * O estado FINAL de todos os elementos é o layout do CSS (y 0, scale 1, visível): sem
 * animação (prefers-reduced-motion) a seção já fica na composição final. O stage é o
 * trigger e o elemento pinado — não é animado; só os filhos são.
 *
 * Position parameter: ">" fim do anterior · "<" junto com o anterior · "+=0.5" pausa
 * · "-=0.5" sobrepõe. Não sobreponha tweens da MESMA propriedade do MESMO elemento.
 */
import { gsap, ScrollTrigger } from "./gsap";
import { MEDIA, type MediaConditions } from "./media";

export type CinematicTimelineParams = {
  /** posição do passo 2 (mídia aparece) — o passo 1 começa em 0 */
  pos2: string;
  /** posição do passo 3 (mídia aumenta) */
  pos3: string;
  /** posição do passo 4 (texto volta para o lugar) */
  pos4: string;
  /** posição do passo 5 (legenda aparece) */
  pos5: string;
  /** pausa no fim, com tudo no lugar, antes de soltar o pin (em "segundos" da timeline) */
  hold: number;
  /** escala do texto enquanto está centralizado (volta a 1 no passo 4) */
  textScale: number;
  /** escala da mídia ao aparecer (volta a 1 no passo 3) */
  mediaScale: number;
  /** brilho da mídia enquanto o texto está na frente (1 = normal; volta a 1 no passo 4) */
  mediaDim: number;
  /** ease padrão de todos os tweens (via `defaults`) */
  ease: string;
  /** duração do pin em alturas de tela */
  screens: number;
  scrub: boolean | number;
  markers: boolean;
};

export type CinematicTimelineElements = {
  /** trigger + pin (não animado). Precisa de position: relative (referência do texto). */
  stage: HTMLElement;
  text: HTMLElement;
  media: HTMLElement;
  caption: HTMLElement;
};

export const CINEMATIC_TIMELINE_ID = "cinematic-timeline";

/**
 * Leva o scroll direto ao FIM da timeline (composição final, pin já solto), sem passar
 * pela sequência: o scrub é concluído na hora em vez de "alcançar" o scroll.
 * Retorna false se a timeline não existe (ex.: prefers-reduced-motion) — nesse caso a
 * seção já está estática e a âncora normal do navegador resolve.
 */
export function scrollToCinematicEnd() {
  const trigger = ScrollTrigger.getById(CINEMATIC_TIMELINE_ID);
  if (!trigger) return false;
  window.scrollTo({ top: trigger.end, behavior: "instant" });
  ScrollTrigger.update();
  trigger.getTween()?.progress(1); // termina a suavização do scrub
  trigger.animation?.progress(1);
  return true;
}

/**
 * @param getOffsetTop altura (px) coberta no topo da tela — ex.: header fixo. O pin começa
 *   abaixo dela e o texto é centralizado na área visível restante.
 */
export function createCinematicTimeline(
  el: CinematicTimelineElements,
  params: CinematicTimelineParams,
  getOffsetTop: () => number = () => 0,
) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { isMobile, reduceMotion } = context.conditions as MediaConditions;
    if (reduceMotion) return; // composição final estática (CSS)

    // y que leva o centro do texto ao centro da área visível durante o pin — no celular,
    // ao centro da mídia (já reduzida) quando ela é uma faixa baixa, mas nunca abaixo do
    // centro da tela (mídia alta, ex.: galeria empilhada, jogaria o texto para fora).
    // Função: recalculada em cada refresh (resize), junto com invalidateOnRefresh.
    // offsetTop é relativo ao stage (position: relative).
    const centerY = () => {
      const screenCenter = (window.innerHeight - getOffsetTop()) / 2;
      const target = isMobile
        ? Math.min(el.media.offsetTop + (el.media.offsetHeight * params.mediaScale) / 2, screenCenter)
        : screenCenter;
      return target - el.text.offsetTop - el.text.offsetHeight / 2;
    };
    // Escala do texto no centro, limitada para ele (ampliado) nunca passar de 94% da tela.
    const textScale = () => {
      const scale = isMobile ? 1 + (params.textScale - 1) / 2 : params.textScale;
      return Math.max(1, Math.min(scale, (window.innerWidth * 0.94) / el.text.offsetWidth));
    };

    // Estado inicial da mídia ANTES da sequência (não faz parte da timeline).
    gsap.set(el.media, { scale: params.mediaScale, transformOrigin: "50% 0%" });

    const tl = gsap.timeline({
      defaults: { ease: params.ease, duration: 1 },
      scrollTrigger: {
        id: CINEMATIC_TIMELINE_ID,
        trigger: el.stage,
        pin: true,
        start: () => `top ${getOffsetTop()}`,
        end: () => `+=${window.innerHeight * params.screens}`,
        scrub: params.scrub,
        invalidateOnRefresh: true,
        anticipatePin: 1,
        // O pin empurra tudo o que vem depois dele. Prioridade maior = medido antes dos
        // ScrollTriggers comuns em todo refresh, mesmo que tenha sido criado depois deles.
        refreshPriority: 1,
        markers: params.markers,
      },
    });

    tl
      // 1 · texto entra no centro da tela
      .fromTo(
        el.text,
        { y: centerY, yPercent: 60, scale: textScale, autoAlpha: 0 },
        { y: centerY, yPercent: 0, scale: textScale, autoAlpha: 1 },
      )

      // 2 · mídia aparece atrás do texto: o recorte abre. O fim negativo (-10%) deixa
      //     sobra para o hover dos cards não ser cortado pelo clip-path.
      //     A mídia surge escurecida para o texto na frente continuar legível.
      .fromTo(
        el.media,
        {
          autoAlpha: 0,
          clipPath: "inset(18% 18% 18% 18% round 24px)",
          filter: `brightness(${params.mediaDim})`,
        },
        { autoAlpha: 1, clipPath: "inset(-10% -10% -10% -10% round 0px)", filter: `brightness(${params.mediaDim})` },
        params.pos2,
      )

      // 3 · mídia aumenta até o tamanho do layout
      .to(el.media, { scale: 1, duration: 1.5 }, params.pos3)

      // 4 · texto sobe para a posição do layout, acima da mídia — e a mídia clareia junto
      .to(el.text, { y: 0, scale: 1 }, params.pos4)
      .to(el.media, { filter: "brightness(1)" }, "<")

      // 5 · legenda aparece
      .fromTo(el.caption, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.8 }, params.pos5)

      // pausa: trecho de scroll com a composição final parada antes de soltar o pin
      .to({}, { duration: params.hold });
  });

  // O espaço do pin (pinSpacing) desloca as seções abaixo, então os ScrollTriggers delas
  // (ex.: Marquee) precisam medir a página de novo. Sem isso, se o pin for (re)criado
  // depois deles — Fast Refresh no `next dev`, ordem de montagem — eles ficam com posições
  // antigas e a animação acontece fora da tela.
  ScrollTrigger.refresh();

  return mm;
}
