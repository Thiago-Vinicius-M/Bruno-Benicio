/**
 * ============================================================================
 * EXEMPLO 07 — VÍDEO COM PIN
 * ============================================================================
 *
 * CONCEITO: pin = "segurar" um elemento na tela enquanto o scroll continua
 *
 *   Sem pin:   o elemento sobe junto com a página.
 *   Com pin:   do start até o end, o elemento fica FIXO na tela
 *              (o ScrollTrigger aplica position: fixed nele) e a página
 *              continua rolando "por baixo". O progresso desse trecho move
 *              a timeline (scrub).
 *
 * O PIN-SPACER E O pinSpacing
 *   Se um elemento vira position: fixed, ele sai do fluxo do documento e
 *   tudo abaixo "subiria" para ocupar o lugar dele. Para evitar isso, o
 *   ScrollTrigger envolve o elemento pinado num <div class="pin-spacer">,
 *   que mantém o tamanho original do elemento.
 *
 *   pinSpacing: true (padrão) → o pin-spacer ganha um padding-bottom igual à
 *     distância do pin (end − start). Resultado: o conteúdo seguinte só
 *     aparece DEPOIS que o pin termina. A seção "ocupa" o tempo do pin.
 *
 *   pinSpacing: false → sem esse padding. O elemento fica preso, mas o
 *     conteúdo seguinte continua subindo e passa POR CIMA dele (útil para
 *     efeitos de "cartas empilhadas"; aqui você vê o bloco seguinte invadir).
 *
 *   ┌───────── pin-spacer ─────────┐
 *   │ ┌──── elemento pinado ─────┐ │ ← altura original (100vh)
 *   │ │                          │ │
 *   │ └──────────────────────────┘ │
 *   │  padding = distância do pin  │ ← só com pinSpacing: true
 *   └──────────────────────────────┘
 *
 * REGRA IMPORTANTE: NÃO ANIME O ELEMENTO PINADO
 *   O ScrollTrigger MEDE o elemento pinado (posição, largura, altura) para
 *   criar o pin-spacer e para aplicar o position: fixed com o tamanho certo.
 *   Se você animar esse mesmo elemento (scale, y, width...), as medições são
 *   feitas com ele "deformado" num momento qualquer — e o pin-spacer, a
 *   largura fixada e os start/end de tudo abaixo ficam errados, pulando na
 *   hora que o pin começa/termina ou após um resize.
 *   SOLUÇÃO: pine o container (section) e anime ELEMENTOS INTERNOS
 *   (aqui: .vp-media, .vp-shade, as legendas). O container nunca muda.
 *
 * start / end
 *   start: "top top"  → o pin começa quando o topo da seção toca o topo da tela
 *   end: "+=N"        → o pin dura N pixels de scroll a partir do start.
 *   Aqui N = telas × window.innerHeight, calculado numa FUNÇÃO para ser
 *   recalculado a cada refresh (resize, rotação do celular).
 *
 * CALLBACKS
 *   onToggle → dispara quando o trigger entra/sai do intervalo ativo.
 *   Usamos para dar play/pause no vídeo apenas enquanto o pin está ativo
 *   (vídeo tocando fora da tela = CPU/bateria desperdiçados).
 *
 * Docs: https://gsap.com/docs/v3/Plugins/ScrollTrigger/ (pin, pinSpacing)
 */
import { gsap } from "gsap";
import { DEBUG_SCROLL } from "../../config/debug";
import { MEDIA, type MediaConditions } from "../../lib/media";

/* ---------------------------------------------------------------------------
 * PARÂMETROS
 * ------------------------------------------------------------------------- */
export type VideoPinParams = {
  /** duração do pin em alturas de tela (end = "+=" + telas × innerHeight) */
  screens: number;
  scrub: boolean | number;
  pinSpacing: boolean;
  /** escala inicial do vídeo (card) antes de expandir */
  scaleFrom: number;
  markers: boolean;
};

export const VIDEO_PIN_DEFAULTS: VideoPinParams = {
  screens: 3,
  scrub: 1,
  pinSpacing: true,
  scaleFrom: 0.6,
  markers: DEBUG_SCROLL,
};

export type VideoPinElements = {
  /** a seção de 100vh: é o TRIGGER e o elemento PINADO. Nunca é animada. */
  section: HTMLElement;
  /** elementos INTERNOS — estes sim são animados */
  media: HTMLElement;
  shade: HTMLElement;
  captions: HTMLElement[];
  video: HTMLVideoElement;
};

export type VideoPinHooks = {
  onProgress?: (progress: number) => void;
  onToggle?: (isActive: boolean) => void;
  onRefresh?: (pinDistance: number) => void;
};

export function createVideoPin(el: VideoPinElements, params: VideoPinParams, hooks: VideoPinHooks = {}) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { isMobile, reduceMotion } = context.conditions as MediaConditions;

    if (reduceMotion) {
      // Sem pin, sem autoplay: vídeo comum com controles; legendas empilhadas (CSS)
      el.video.controls = true;
      return () => {
        el.video.controls = false;
      };
    }

    // No mobile o vídeo já ocupa quase toda a largura: começar muito pequeno
    // desperdiçaria a tela. Começamos maiores.
    const scaleFrom = isMobile ? Math.max(params.scaleFrom, 0.85) : params.scaleFrom;

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        id: "07-video-pin",
        trigger: el.section,
        pin: true, // fixa o PRÓPRIO trigger (el.section)
        pinSpacing: params.pinSpacing,
        start: "top top",
        // função → recalculada em todo refresh (resize/rotação)
        end: () => `+=${window.innerHeight * params.screens}`,
        scrub: params.scrub,
        anticipatePin: 1, // ajuda a evitar um "tranco" quando se rola muito rápido até o pin
        invalidateOnRefresh: true,
        markers: params.markers,
        onUpdate: (self) => hooks.onProgress?.(self.progress),
        onToggle: (self) => {
          hooks.onToggle?.(self.isActive);
          if (self.isActive) el.video.play().catch(() => {});
          else el.video.pause();
        },
        onRefresh: (self) => hooks.onRefresh?.(self.end - self.start),
      },
    });

    // 1) o vídeo cresce de "card" para tela cheia
    tl.fromTo(el.media, { scale: scaleFrom, borderRadius: 28 }, { scale: 1, borderRadius: 0, duration: 1 })
      // 2) escurece um pouco para o texto ficar legível (começa antes do 1 terminar)
      .to(el.shade, { opacity: 0.55, duration: 0.4 }, "-=0.3");

    // 3) cada legenda entra, fica um tempo, e sai (a última fica)
    el.captions.forEach((caption, i) => {
      tl.fromTo(caption, { autoAlpha: 0, yPercent: 40 }, { autoAlpha: 1, yPercent: 0, duration: 0.4 });
      if (i < el.captions.length - 1) {
        tl.to(caption, { autoAlpha: 0, yPercent: -40, duration: 0.4 }, "+=0.6");
      }
    });

    // 4) "respiro" no fim: nada anima, mas o pin continua por mais um trecho
    tl.to({}, { duration: 0.6 });
  });

  return mm;
}
