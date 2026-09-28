import { useRef, type CSSProperties } from "react";
import { useGSAP } from "@gsap/react";
import { AnimationSection } from "../../components/AnimationSection";
import { Meter, Readout, type MeterHandle, type ReadoutHandle } from "../../components/Hud";
import { SCRUB_OPTIONS } from "../../lab/options";
import type { Control, ExampleProps } from "../../lab/types";
import { useLabParams } from "../../lab/useLabParams";
import { createVideoScroll, VIDEO_SCROLL_DEFAULTS, waitForMetadata, type VideoScrollParams } from "./animation";
import source from "./animation.ts?raw";
import "./styles.css";

const FPS = 29.97; // taxa de quadros do arquivo (só para exibir o nº do frame)

const CONTROLS: Control<VideoScrollParams>[] = [
  {
    type: "select",
    key: "method",
    label: "método",
    group: "scrollTrigger",
    options: [
      { label: "tween — gsap.fromTo(currentTime)", value: "tween" },
      { label: "onUpdate — progress × duration", value: "onUpdate" },
    ],
  },
  {
    type: "select",
    key: "scrub",
    label: "scrub",
    group: "scrollTrigger",
    options: SCRUB_OPTIONS,
    hint: "Só existe no método tween (onUpdate não tem animação para suavizar).",
    disabled: (p) => p.method !== "tween",
  },
  {
    type: "text",
    key: "start",
    label: "start",
    group: "scrollTrigger",
    suggestions: ["top top", "top center", "top bottom"],
  },
  {
    type: "text",
    key: "end",
    label: "end",
    group: "scrollTrigger",
    suggestions: ["bottom bottom", "bottom center", "bottom top"],
  },
  {
    type: "range",
    key: "screens",
    label: "altura do trilho",
    group: "layout",
    min: 1.5,
    max: 8,
    step: 0.5,
    unit: " telas",
    hint: "Distância de scroll (CSS). Mais telas = vídeo mais “lento” por pixel rolado.",
  },
  { type: "toggle", key: "markers", label: "markers", group: "debug" },
];

function toSnippet(p: VideoScrollParams) {
  const wait = `// 1) esperar o metadata (duration) antes de tudo
waitForMetadata(video, () => {
  const duration = video.duration;   // ex.: 5.0`;
  if (p.method === "tween") {
    return `${wait}

  // 2) GSAP anima a propriedade numérica currentTime
  gsap.fromTo(video,
    { currentTime: 0 },
    {
      currentTime: duration,
      ease: "none",
      scrollTrigger: {
        trigger: track,        // trilho de ${p.screens} telas
        start: "${p.start}",
        end: "${p.end}",
        scrub: ${p.scrub},
        markers: ${p.markers},
      },
    },
  );
});`;
  }
  return `${wait}

  // 2) conversão explícita progress → currentTime
  ScrollTrigger.create({
    trigger: track,          // trilho de ${p.screens} telas
    start: "${p.start}",
    end: "${p.end}",
    markers: ${p.markers},
    onUpdate: (self) => {
      video.currentTime = self.progress * duration;
    },
  });
});`;
}

export function Example06VideoScroll({ meta }: ExampleProps) {
  const lab = useLabParams(VIDEO_SCROLL_DEFAULTS);
  const { params } = lab;

  const trackRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressMeter = useRef<MeterHandle>(null);
  const timeMeter = useRef<MeterHandle>(null);
  const statusOut = useRef<ReadoutHandle>(null);
  const frameOut = useRef<ReadoutHandle>(null);

  useGSAP(
    (_context, contextSafe) => {
      const video = videoRef.current!;
      let mm: gsap.MatchMedia | undefined;

      statusOut.current?.set(`aguardando metadata (readyState ${video.readyState})`);

      // `build` roda DEPOIS, quando o metadata chegar. contextSafe() faz com
      // que o que for criado lá dentro continue registrado no contexto do
      // useGSAP (e seja revertido no cleanup), mesmo sendo assíncrono.
      const build = contextSafe!(() => {
        statusOut.current?.set(`pronto · duration ${video.duration.toFixed(2)}s`);
        mm = createVideoScroll({ track: trackRef.current!, video }, params, {
          onProgress: (p) => progressMeter.current?.set(p),
          onTime: (time, duration) => {
            timeMeter.current?.set(time / duration, `${time.toFixed(2)}s / ${duration.toFixed(2)}s`);
            frameOut.current?.set(`${Math.round(time * FPS)} / ${Math.round(duration * FPS)}`);
          },
          onInvalid: (reason) => statusOut.current?.set(reason),
        });
      });

      const stopWaiting = waitForMetadata(video, build, () =>
        statusOut.current?.set("erro ao carregar o vídeo (veja o console / Network)"),
      );

      return () => {
        stopWaiting(); // remove listeners se ainda estiver esperando
        mm?.revert();
      };
    },
    { dependencies: [params, lab.runId], revertOnUpdate: true },
  );

  const trackStyle = { "--screens": params.screens } as CSSProperties;

  return (
    <AnimationSection
      meta={meta}
      lab={lab}
      controls={CONTROLS}
      snippet={toSnippet(params)}
      source={source}
      summary={[
        ["método", params.method],
        ["scrub", params.method === "tween" ? String(params.scrub) : "—"],
        ["trilho", `${params.screens} telas`],
        ["start → end", `${params.start} → ${params.end}`],
      ]}
    >
      <div className="vs-track is-trigger" ref={trackRef} style={trackStyle} data-label="trigger · trilho">
        <div className="vs-sticky wrap">
          <div className="vs-media">
            <video
              ref={videoRef}
              className="vs-video"
              src="/media/video/flower-scrub.mp4"
              poster="/media/video/flower-scrub-poster.webp"
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
              aria-label="Vídeo de uma flor vermelha desabrochando, controlado pela rolagem da página."
            />
            <span className="vs-badge">position: sticky (CSS)</span>
          </div>

          <div className="hud vs-hud">
            <span className="hud__title">vídeo ↔ scroll</span>
            <Readout label="status" ref={statusOut} />
            <Meter label="ScrollTrigger.progress" ref={progressMeter} />
            <Meter label="currentTime / duration" tone="alt" ref={timeMeter} />
            <Readout label="frame (≈)" ref={frameOut} />
          </div>
        </div>
      </div>
    </AnimationSection>
  );
}
