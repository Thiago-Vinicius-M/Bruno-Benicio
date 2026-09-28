import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { AnimationSection } from "../../components/AnimationSection";
import { Meter, Readout, type MeterHandle, type ReadoutHandle } from "../../components/Hud";
import { SCRUB_OPTIONS } from "../../lab/options";
import type { Control, ExampleProps } from "../../lab/types";
import { useLabParams } from "../../lab/useLabParams";
import { createVideoPin, VIDEO_PIN_DEFAULTS, type VideoPinParams } from "./animation";
import source from "./animation.ts?raw";
import "./styles.css";

const CAPTIONS = [
  { title: "O vídeo está preso.", text: "pin: true aplicou position: fixed na seção. A página continua rolando por baixo." },
  { title: "O scroll virou tempo.", text: "Cada pixel entre start e end move o playhead da timeline (scrub)." },
  { title: "O espaço foi reservado.", text: "O pin-spacer ganhou padding = distância do pin. Por isso nada “sobe” antes da hora." },
];

const CONTROLS: Control<VideoPinParams>[] = [
  {
    type: "range",
    key: "screens",
    label: "end (+= telas)",
    group: "scrollTrigger",
    min: 1,
    max: 6,
    step: 0.5,
    unit: " telas",
    hint: 'end: () => "+=" + innerHeight × telas. Mais telas = pin mais longo.',
  },
  { type: "select", key: "scrub", label: "scrub", group: "scrollTrigger", options: SCRUB_OPTIONS },
  {
    type: "toggle",
    key: "pinSpacing",
    label: "pinSpacing",
    group: "scrollTrigger",
    hint: "false: o bloco seguinte sobe por cima do vídeo pinado.",
  },
  { type: "range", key: "scaleFrom", label: "scale inicial do vídeo", group: "timeline", min: 0.3, max: 1, step: 0.05 },
  { type: "toggle", key: "markers", label: "markers", group: "debug" },
];

function toSnippet(p: VideoPinParams) {
  return `const tl = gsap.timeline({
  defaults: { ease: "none" },
  scrollTrigger: {
    trigger: section,          // pinado — NUNCA animado
    pin: true,
    pinSpacing: ${p.pinSpacing},
    start: "top top",
    end: () => "+=" + window.innerHeight * ${p.screens},
    scrub: ${p.scrub},
    anticipatePin: 1,
    invalidateOnRefresh: true,
    markers: ${p.markers},
    onToggle: (self) => self.isActive ? video.play() : video.pause(),
  },
});

// anima só os filhos:
tl.fromTo(media, { scale: ${p.scaleFrom}, borderRadius: 28 },
                 { scale: 1, borderRadius: 0, duration: 1 })
  .to(shade, { opacity: 0.55, duration: 0.4 }, "-=0.3");

captions.forEach((c, i) => {
  tl.fromTo(c, { autoAlpha: 0, yPercent: 40 },
               { autoAlpha: 1, yPercent: 0, duration: 0.4 });
  if (i < captions.length - 1)
    tl.to(c, { autoAlpha: 0, yPercent: -40, duration: 0.4 }, "+=0.6");
});`;
}

export function Example07VideoPin({ meta }: ExampleProps) {
  const lab = useLabParams(VIDEO_PIN_DEFAULTS);
  const { params } = lab;

  const sectionRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const captionsRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressMeter = useRef<MeterHandle>(null);
  const activeOut = useRef<ReadoutHandle>(null);
  const distanceOut = useRef<ReadoutHandle>(null);

  useGSAP(
    () => {
      const mm = createVideoPin(
        {
          section: sectionRef.current!,
          media: mediaRef.current!,
          shade: shadeRef.current!,
          captions: gsap.utils.toArray<HTMLElement>(".vp-caption", captionsRef.current),
          video: videoRef.current!,
        },
        params,
        {
          onProgress: (p) => progressMeter.current?.set(p),
          onToggle: (active) => activeOut.current?.set(active ? "sim — position: fixed" : "não"),
          onRefresh: (distance) => distanceOut.current?.set(`${Math.round(distance)}px`),
        },
      );
      return () => mm.revert();
    },
    { dependencies: [params, lab.runId], revertOnUpdate: true },
  );

  return (
    <AnimationSection
      meta={meta}
      lab={lab}
      controls={CONTROLS}
      snippet={toSnippet(params)}
      source={source}
      summary={[
        ["pin", "true"],
        ["end", `+= ${params.screens} telas`],
        ["pinSpacing", String(params.pinSpacing)],
        ["scrub", String(params.scrub)],
      ]}
    >
      {/* Este div é o TRIGGER e o elemento PINADO. Nada nele é animado. */}
      <div className="vp-section" ref={sectionRef}>
        <div className="vp-media" ref={mediaRef}>
          <video
            ref={videoRef}
            className="vp-video"
            src="/media/video/sintel-flight.mp4"
            poster="/media/video/sintel-flight-poster.webp"
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="Trecho da animação Sintel: um dragão voa sobre um céu alaranjado."
          />
          <div className="vp-shade" ref={shadeRef} />
        </div>

        <div className="vp-captions" ref={captionsRef}>
          {CAPTIONS.map((c, i) => (
            <div className="vp-caption" key={c.title}>
              <span className="kicker">
                {String(i + 1).padStart(2, "0")} / {String(CAPTIONS.length).padStart(2, "0")}
              </span>
              <p className="vp-caption__title">{c.title}</p>
              <p className="vp-caption__text">{c.text}</p>
            </div>
          ))}
        </div>

        <div className="hud vp-hud">
          <span className="hud__title">pin</span>
          <Meter label="progress" ref={progressMeter} />
          <Readout label="pin ativo" initial="não" ref={activeOut} />
          <Readout label="end − start" ref={distanceOut} />
        </div>
      </div>

      <div className="vp-after wrap">
        <p className="kicker">depois do pin</p>
        <p className="vp-after__text">
          Com <code>pinSpacing: {String(params.pinSpacing)}</code>,{" "}
          {params.pinSpacing
            ? "este bloco esperou o pin terminar: o pin-spacer reservou a distância do pin."
            : "este bloco subiu POR CIMA do vídeo enquanto ele estava preso: não houve espaço reservado."}
        </p>
      </div>
    </AnimationSection>
  );
}
