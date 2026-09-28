/**
 * ============================================================================
 * EXEMPLO 06 — VÍDEO CONTROLADO PELO SCROLL
 * ============================================================================
 *
 * CONCEITO: o vídeo vira uma "animação" cujo playhead é o currentTime
 *
 *   ScrollTrigger.progress  0 ─────────── 0.5 ─────────── 1
 *   video.currentTime       0s ────── duration/2 ────── duration
 *
 *   currentTime = progress × duration
 *
 * POR QUE PRECISAMOS CONHECER `duration` ANTES?
 *   1. Antes do metadata carregar, `video.duration` é NaN. progress × NaN =
 *      NaN, e `video.currentTime = NaN` LANÇA um erro (TypeError: valor não
 *      finito). O código quebraria no primeiro scroll.
 *   2. O tween `currentTime: duration` "congela" o valor final no momento em
 *      que é criado. Se você criar com um chute (ex.: 1s) e o vídeo tiver 5s,
 *      o scroll inteiro mapearia só o primeiro segundo.
 *   3. Vídeos de stream ao vivo têm duration = Infinity — não dá para mapear.
 *   Por isso: esperamos `loadedmetadata` (ou readyState ≥ HAVE_METADATA),
 *   validamos a duration e SÓ ENTÃO criamos a animação.
 *
 * O QUE O METADATA TRAZ
 *   duration, videoWidth, videoHeight. Os FRAMES vêm depois (readyState 2+).
 *   `preload="auto"` pede para o navegador baixar o vídeo todo — necessário
 *   para o scrub responder rápido (preload="metadata" só baixa o cabeçalho).
 *
 * POR QUE O VÍDEO FOI RECODIFICADO COM "TODOS OS FRAMES-CHAVE"?
 *   Vídeos comprimidos guardam um frame completo (keyframe) a cada N frames;
 *   os outros são só "diferenças". Para exibir o frame 57, o navegador
 *   precisa decodificar desde o keyframe anterior. No scrub (e principalmente
 *   rolando para TRÁS), isso trava. O arquivo flower-scrub.mp4 foi gerado com
 *   `ffmpeg -g 1` (todo frame é keyframe): arquivo maior, seek instantâneo.
 *
 * DOIS MÉTODOS (escolha no painel)
 *   "tween":    gsap.fromTo(video, { currentTime: 0 }, { currentTime: duration })
 *               GSAP interpola a propriedade numérica currentTime como faria
 *               com qualquer número. Vantagem: aceita scrub numérico
 *               (suavização) e ease. Uma atualização por frame (ticker do GSAP).
 *   "onUpdate": ScrollTrigger.create({ onUpdate: self => ... }) e nós mesmos
 *               fazemos `video.currentTime = self.progress * duration`.
 *               É a conversão explícita, sem suavização (scrub não existe
 *               aqui porque não há animação ligada ao ScrollTrigger).
 *
 * TRIGGER / start / end — o trilho + position: sticky
 *   O trigger é um "trilho" alto (N telas). Dentro dele, o vídeo usa
 *   `position: sticky` (CSS, não GSAP!) para ficar parado na tela.
 *   start: "top top"       → topo do trilho no topo da tela (sticky começa)
 *   end:   "bottom bottom" → base do trilho na base da tela (sticky termina)
 *   Então o progress vai de 0 a 1 exatamente enquanto o vídeo está parado na
 *   tela. Mais telas de trilho = mais scroll para o mesmo vídeo = mais controle.
 *   (No exemplo 07 fazemos algo parecido com `pin` do ScrollTrigger.)
 *
 * Docs: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
 *       https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/readyState
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DEBUG_SCROLL } from "../../config/debug";
import { MEDIA, type MediaConditions } from "../../lib/media";

/* ---------------------------------------------------------------------------
 * PARÂMETROS
 * ------------------------------------------------------------------------- */
export type VideoScrollParams = {
  method: "tween" | "onUpdate";
  /** só vale no método "tween" */
  scrub: boolean | number;
  /** altura do trilho, em alturas de tela (define a distância de scroll) */
  screens: number;
  start: string;
  end: string;
  markers: boolean;
};

export const VIDEO_SCROLL_DEFAULTS: VideoScrollParams = {
  method: "tween",
  scrub: 0.5,
  screens: 3,
  start: "top top",
  end: "bottom bottom",
  markers: DEBUG_SCROLL,
};

/* ---------------------------------------------------------------------------
 * PASSO 1 — esperar o metadata (duration) com segurança
 * ------------------------------------------------------------------------- */

/**
 * Chama `onReady` quando o vídeo souber a própria duração.
 * Retorna uma função de limpeza que remove os listeners — importante no React:
 * se o componente desmontar antes do metadata chegar, nada fica pendurado.
 */
export function waitForMetadata(video: HTMLVideoElement, onReady: () => void, onError: () => void): () => void {
  // readyState ≥ 1 (HAVE_METADATA): o metadata JÁ chegou (ex.: cache, ou o
  // vídeo carregou antes do React montar). O evento não vai disparar de novo!
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    onReady();
    return () => {};
  }
  if (video.error) {
    onError();
    return () => {};
  }

  video.addEventListener("loadedmetadata", onReady, { once: true });
  video.addEventListener("error", onError, { once: true });

  return () => {
    video.removeEventListener("loadedmetadata", onReady);
    video.removeEventListener("error", onError);
  };
}

/**
 * Safari no iOS pode não decodificar/pintar frames de um vídeo que nunca foi
 * "tocado". Um play() seguido de pause() "destrava" o vídeo. Como ele é
 * muted + playsInline, o navegador permite o play sem interação do usuário.
 * Se mesmo assim for bloqueado, ignoramos: o scrub continua funcionando nos
 * navegadores que não precisam disso.
 */
function primeVideo(video: HTMLVideoElement) {
  video
    .play()
    .then(() => video.pause())
    .catch(() => {});
}

/* ---------------------------------------------------------------------------
 * PASSO 2 — criar a animação (chamar SÓ depois do metadata)
 * ------------------------------------------------------------------------- */
export type VideoScrollElements = {
  /** trilho alto: é o trigger */
  track: HTMLElement;
  video: HTMLVideoElement;
};

export type VideoScrollHooks = {
  onProgress?: (progress: number) => void;
  onTime?: (time: number, duration: number) => void;
  onInvalid?: (reason: string) => void;
};

export function createVideoScroll(el: VideoScrollElements, params: VideoScrollParams, hooks: VideoScrollHooks = {}) {
  const mm = gsap.matchMedia();
  const { video } = el;

  mm.add(MEDIA, (context) => {
    const { reduceMotion } = context.conditions as MediaConditions;

    if (reduceMotion) {
      // Sem vínculo com o scroll: o usuário controla o vídeo pelos controles
      // nativos. A função retornada roda quando a condição deixa de valer.
      video.controls = true;
      return () => {
        video.controls = false;
      };
    }

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      hooks.onInvalid?.(`duration inválida: ${duration}`);
      return;
    }

    primeVideo(video);

    if (params.method === "tween") {
      // MÉTODO A — GSAP interpola currentTime (aceita scrub numérico)
      gsap.fromTo(
        video,
        { currentTime: 0 },
        {
          currentTime: duration,
          ease: "none", // 10% de scroll = 10% do vídeo
          onUpdate: () => hooks.onTime?.(video.currentTime, duration),
          scrollTrigger: {
            id: "06-video-scroll",
            trigger: el.track,
            start: params.start,
            end: params.end,
            scrub: params.scrub,
            markers: params.markers,
            onUpdate: (self) => hooks.onProgress?.(self.progress),
          },
        },
      );
    } else {
      // MÉTODO B — conversão explícita progress → currentTime
      const st = ScrollTrigger.create({
        id: "06-video-scroll",
        trigger: el.track,
        start: params.start,
        end: params.end,
        markers: params.markers,
        onUpdate: (self) => {
          const time = self.progress * duration; // ← a conversão
          video.currentTime = time;
          hooks.onProgress?.(self.progress);
          hooks.onTime?.(time, duration);
        },
      });
      // Sincroniza já na criação (se a página estiver no meio do trilho)
      video.currentTime = st.progress * duration;
    }
  });

  return mm;
}
