/**
 * ============================================================================
 * EXEMPLO 10 — SNAP + SCROLL STORY
 * ============================================================================
 *
 * CONCEITO: uma seção pinada com N "momentos", e o snap encaixa em cada um
 *
 *   progress:  0 ─────────── 0.33 ─────────── 0.67 ─────────── 1
 *   labels:  "intro"       "imagem"         "video"          "final"
 *
 *   Você rola e SOLTA no meio de uma transição. Depois que o scroll para,
 *   o ScrollTrigger anima a posição do scroll até o valor de snap mais
 *   próximo (na direção em que você rolava, com `directional: true`).
 *
 * O QUE É SNAP (e o que NÃO é)
 *   - Não bloqueia o scroll nem sequestra a roda do mouse (sem scroll-jacking):
 *     você rola livremente; o snap só age QUANDO VOCÊ PARA.
 *   - Se você voltar a rolar durante o snap, ele desiste (onInterrupt).
 *   - Ele age sobre o PROGRESS do ScrollTrigger (0–1), e por consequência
 *     sobre a posição real do scroll.
 *
 * FORMAS DE snap (todas da doc oficial)
 *   snap: 0.1                → múltiplos de 10% (0, 0.1, 0.2...)
 *   snap: [0, 0.5, 1]        → só esses valores
 *   snap: "labels"           → progress de cada label da timeline
 *   snap: (value) => ...     → sua própria regra
 *   snap: { snapTo, duration, delay, ease, directional, inertia, ... }
 *     snapTo:    qualquer uma das formas acima
 *     duration:  { min, max } → a duração se ajusta à distância/velocidade
 *     delay:     espera após o scroll parar antes de encaixar
 *     directional: encaixa no próximo ponto NA DIREÇÃO do scroll (padrão true)
 *
 * snap COM LABELS
 *   tl.addLabel("imagem") marca um ponto no tempo da timeline. Com
 *   snapTo: "labels", o ScrollTrigger converte o tempo de cada label em
 *   progress (tempo ÷ duração total) e usa esses valores. Vantagem: se você
 *   mudar durações, os pontos de snap acompanham sozinhos.
 *   Aqui os momentos são igualmente espaçados, então "labels" = 1/(n−1).
 *
 * QUANTIDADE E DISTÂNCIA ENTRE MOMENTOS
 *   - quantidade: é o nº de camadas no JSX (array MOMENTS no componente).
 *     O loop abaixo cria uma transição + um label para cada uma.
 *   - distância: end = telasPorMomento × innerHeight × (n − 1).
 *     "hold" é um tween vazio (tl.to({}, {duration})) que faz o momento
 *     ficar parado por um trecho de scroll antes da próxima transição.
 *
 * QUANDO USAR / NÃO USAR SNAP
 *   ✔ histórias em etapas, carrosséis pinados, "slides" com conteúdo curto
 *   ✘ conteúdo longo para LER (o snap pode puxar o texto para longe)
 *   ✘ trechos muito longos entre pontos (o encaixe vira um "salto" grande)
 *   ✘ junto com CSS scroll-snap no mesmo container (os dois brigam)
 *   ✘ vários snaps curtinhos seguidos (sensação de página "grudenta")
 *
 * Docs: https://gsap.com/docs/v3/Plugins/ScrollTrigger/ (snap)
 *       https://gsap.com/docs/v3/GSAP/Timeline/addLabel()
 *       https://gsap.com/docs/v3/Plugins/ScrollTrigger/labelToScroll()
 */
import { gsap } from "gsap";
import { DEBUG_SCROLL } from "../../config/debug";
import { MEDIA, type MediaConditions } from "../../lib/media";

/* ---------------------------------------------------------------------------
 * PARÂMETROS
 * ------------------------------------------------------------------------- */
export type SnapMode = "labels" | "even" | "tenth" | "off";

export type SnapStoryParams = {
  snapMode: SnapMode;
  directional: boolean;
  /** duração máxima do encaixe (s). A mínima é 0.2s. */
  snapDuration: number;
  /** espera depois que o scroll para (s) */
  snapDelay: number;
  /** distância de scroll entre dois momentos, em alturas de tela */
  screensPerMoment: number;
  /** trecho (em "segundos" de timeline) em que cada momento fica parado */
  hold: number;
  scrub: boolean | number;
  markers: boolean;
};

export const SNAP_STORY_DEFAULTS: SnapStoryParams = {
  snapMode: "labels",
  directional: true,
  snapDuration: 0.8,
  snapDelay: 0.1,
  screensPerMoment: 1,
  hold: 0.5,
  scrub: 1,
  markers: DEBUG_SCROLL,
};

/** Monta o objeto `snap` exatamente como ele vai para o ScrollTrigger */
export function buildSnap(p: SnapStoryParams, count: number): ScrollTrigger.SnapVars | undefined {
  if (p.snapMode === "off") return undefined;
  const snapTo = p.snapMode === "labels" ? "labels" : p.snapMode === "even" ? 1 / (count - 1) : 0.1;
  return {
    snapTo,
    duration: { min: Math.min(0.2, p.snapDuration), max: p.snapDuration },
    delay: p.snapDelay,
    ease: "power1.inOut",
    directional: p.directional,
  };
}

export type SnapStoryElements = {
  /** seção de 100vh: trigger + pin (não animada) */
  section: HTMLElement;
  /** uma camada por momento, empilhadas no CSS */
  layers: HTMLElement[];
  /** vídeo do momento "video" (toca só quando esse momento está ativo) */
  video: HTMLVideoElement | null;
};

export type LabelInfo = { name: string; progress: number };

export type SnapStoryHooks = {
  onProgress?: (progress: number) => void;
  onLabelChange?: (label: string) => void;
  onLabelsBuilt?: (labels: LabelInfo[]) => void;
  onSnapComplete?: (progress: number, label: string | null) => void;
};

export function createSnapStory(
  el: SnapStoryElements,
  labels: string[],
  videoLabel: string,
  params: SnapStoryParams,
  hooks: SnapStoryHooks = {},
) {
  const mm = gsap.matchMedia();

  // Navegação pelos pontos: definida dentro do matchMedia (depende da versão)
  let scrollToMoment = (index: number) => el.layers[index]?.scrollIntoView({ block: "start" });

  mm.add(MEDIA, (context) => {
    const { reduceMotion } = context.conditions as MediaConditions;

    if (reduceMotion) {
      // Camadas empilhadas (CSS), sem pin, sem snap, vídeo com controles.
      if (el.video) el.video.controls = true;
      scrollToMoment = (index) => el.layers[index]?.scrollIntoView({ block: "start" });
      return () => {
        if (el.video) el.video.controls = false;
      };
    }

    const count = el.layers.length;
    let currentLabel = "";

    const syncVideo = (label: string) => {
      if (!el.video) return;
      if (label === videoLabel) el.video.play().catch(() => {});
      else el.video.pause();
    };

    const tl = gsap.timeline({
      defaults: { duration: 1, ease: "power2.inOut" },

      // onUpdate DA TIMELINE (não do ScrollTrigger): com scrub numérico o
      // playhead continua andando depois que o scroll para, e só o callback
      // da timeline acompanha isso. `this` = a timeline.
      // currentLabel() = último label pelo qual o playhead passou.
      onUpdate: function (this: gsap.core.Timeline) {
        const label = this.currentLabel();
        if (label !== currentLabel) {
          currentLabel = label;
          hooks.onLabelChange?.(label);
          syncVideo(label);
        }
      },

      scrollTrigger: {
        id: "10-snap-story",
        trigger: el.section,
        pin: true,
        start: "top top",
        end: () => `+=${window.innerHeight * params.screensPerMoment * (count - 1)}`,
        scrub: params.scrub,
        snap: buildSnap(params, count),
        invalidateOnRefresh: true,
        anticipatePin: 1,
        markers: params.markers,
        onUpdate: (self) => hooks.onProgress?.(self.progress),
        onToggle: (self) => (self.isActive ? syncVideo(currentLabel) : el.video?.pause()),
        // O snap encaixa o PROGRESS (posição do scroll). Reportamos esse valor
        // e o label que fica exatamente nele (se houver).
        onSnapComplete: (self) => hooks.onSnapComplete?.(self.progress, labelAtProgress(self.progress)),
      },
    });

    const labelAtProgress = (progress: number) => {
      const time = progress * tl.duration();
      const found = Object.entries(tl.labels).find(([, t]) => Math.abs(t - time) < 0.01);
      return found ? found[0] : null;
    };

    // ---- construção da história: label, (respiro), transição, label... ----
    tl.addLabel(labels[0], 0);

    for (let i = 1; i < count; i++) {
      // respiro: tween "vazio" — o tempo passa, nada muda na tela
      if (params.hold > 0) tl.to({}, { duration: params.hold });

      tl
        // camada anterior sai...
        .to(el.layers[i - 1], { autoAlpha: 0, yPercent: -6, scale: 0.97 })
        // ...enquanto a próxima entra (mesmo início: "<")
        .fromTo(el.layers[i], { autoAlpha: 0, yPercent: 6, scale: 1.04 }, { autoAlpha: 1, yPercent: 0, scale: 1 }, "<")
        // marca o ponto em que este momento está 100% visível
        .addLabel(labels[i]);
    }

    // tempo de cada label → progress (é isso que o snap "labels" usa)
    const total = tl.duration();
    hooks.onLabelsBuilt?.(Object.entries(tl.labels).map(([name, time]) => ({ name, progress: time / total })));

    // Navegação: labelToScroll() converte um label em posição de scroll (px)
    scrollToMoment = (index) => {
      const st = tl.scrollTrigger;
      if (st) window.scrollTo({ top: st.labelToScroll(labels[index]), behavior: "smooth" });
    };

    return () => el.video?.pause();
  });

  return {
    mm,
    scrollToMoment: (index: number) => scrollToMoment(index),
  };
}
