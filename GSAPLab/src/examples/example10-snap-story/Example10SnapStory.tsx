import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { AnimationSection } from "../../components/AnimationSection";
import { Meter, Readout, type MeterHandle, type ReadoutHandle } from "../../components/Hud";
import { SCRUB_OPTIONS } from "../../lab/options";
import type { Control, ExampleProps } from "../../lab/types";
import { useLabParams } from "../../lab/useLabParams";
import { buildSnap, createSnapStory, SNAP_STORY_DEFAULTS, type LabelInfo, type SnapStoryParams } from "./animation";
import source from "./animation.ts?raw";
import "./styles.css";

/**
 * Os MOMENTOS da história. Para ter 3, 5, 6 momentos, edite este array:
 * o JSX cria uma camada por item e a timeline cria uma transição + label
 * para cada camada (o `label` de cada item vira o nome do label).
 */
const MOMENTS = [
  {
    label: "intro",
    kind: "text",
    kicker: "Momento 01 · texto",
    title: "Uma seção. Uma timeline. Quatro paradas.",
    text: "Role um pouco e solte. O snap termina o movimento até o próximo momento.",
  },
  {
    label: "imagem",
    kind: "image",
    kicker: "Momento 02 · imagem",
    title: "Cada parada é um label.",
    text: 'tl.addLabel("imagem") — o snap usa o progress de cada label.',
    src: "/media/images/story-valley.webp",
    alt: "Paredão de granito entre pinheiros, refletido num rio calmo.",
  },
  {
    label: "video",
    kind: "video",
    kicker: "Momento 03 · vídeo",
    title: "O vídeo só toca aqui.",
    text: "onUpdate lê tl.currentLabel() e dá play/pause quando o momento muda.",
    src: "/media/video/sintel-dunes.mp4",
    poster: "/media/video/sintel-dunes-poster.webp",
    alt: "Dunas de areia sob um céu claro (trecho de Sintel).",
  },
  {
    label: "final",
    kind: "text",
    kicker: "Momento 04 · mensagem final",
    title: "Fim do pin. A página segue.",
    text: "Depois do último label, o pin termina e o scroll volta ao normal — sem prender o usuário.",
  },
] as const;

const LABELS = MOMENTS.map((m) => m.label);
const VIDEO_LABEL = "video";

const CONTROLS: Control<SnapStoryParams>[] = [
  {
    type: "select",
    key: "snapMode",
    label: "snapTo",
    group: "scrollTrigger",
    options: [
      { label: '"labels" — nos momentos', value: "labels" },
      { label: "1 / (n − 1) — mesmo efeito aqui", value: "even" },
      { label: "0.1 — de 10 em 10% (desalinhado)", value: "tenth" },
      { label: "sem snap", value: "off" },
    ],
  },
  {
    type: "toggle",
    key: "directional",
    label: "directional",
    group: "scrollTrigger",
    hint: "true: encaixa no próximo ponto NA DIREÇÃO do scroll.",
    disabled: (p) => p.snapMode === "off",
  },
  {
    type: "range",
    key: "snapDuration",
    label: "duration.max",
    group: "scrollTrigger",
    min: 0.2,
    max: 2,
    step: 0.1,
    unit: "s",
    disabled: (p) => p.snapMode === "off",
  },
  {
    type: "range",
    key: "snapDelay",
    label: "delay",
    group: "scrollTrigger",
    min: 0,
    max: 1,
    step: 0.05,
    unit: "s",
    disabled: (p) => p.snapMode === "off",
  },
  { type: "select", key: "scrub", label: "scrub", group: "scrollTrigger", options: SCRUB_OPTIONS },
  {
    type: "range",
    key: "screensPerMoment",
    label: "distância entre momentos",
    group: "timeline",
    min: 0.5,
    max: 3,
    step: 0.25,
    unit: " telas",
  },
  {
    type: "range",
    key: "hold",
    label: "respiro (hold)",
    group: "timeline",
    min: 0,
    max: 2,
    step: 0.25,
    hint: "Tempo parado em cada momento antes da próxima transição.",
  },
  { type: "toggle", key: "markers", label: "markers", group: "debug" },
];

function toSnippet(p: SnapStoryParams) {
  const snap = buildSnap(p, MOMENTS.length);
  const snapCode = snap
    ? `{
      snapTo: ${typeof snap.snapTo === "string" ? `"${snap.snapTo}"` : Number(snap.snapTo).toFixed(3)},
      duration: { min: ${Math.min(0.2, p.snapDuration)}, max: ${p.snapDuration} },
      delay: ${p.snapDelay},
      ease: "power1.inOut",
      directional: ${p.directional},
    }`
    : "undefined, // sem snap";
  return `const tl = gsap.timeline({
  defaults: { duration: 1, ease: "power2.inOut" },
  scrollTrigger: {
    trigger: section,
    pin: true,
    start: "top top",
    end: () => "+=" + innerHeight * ${p.screensPerMoment} * (layers.length - 1),
    scrub: ${p.scrub},
    snap: ${snapCode}
  },
});

tl.addLabel("${LABELS[0]}", 0);
for (let i = 1; i < layers.length; i++) {
  tl.to({}, { duration: ${p.hold} })                   // respiro
    .to(layers[i - 1], { autoAlpha: 0, yPercent: -6, scale: 0.97 })
    .fromTo(layers[i], { autoAlpha: 0, yPercent: 6, scale: 1.04 },
                       { autoAlpha: 1, yPercent: 0, scale: 1 }, "<")
    .addLabel(labels[i]);   // ${LABELS.slice(1).map((l) => `"${l}"`).join(", ")}
}`;
}

export function Example10SnapStory({ meta }: ExampleProps) {
  const lab = useLabParams(SNAP_STORY_DEFAULTS);
  const { params } = lab;

  const sectionRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useRef<(index: number) => void>(() => {});
  const progressMeter = useRef<MeterHandle>(null);
  const snapOut = useRef<ReadoutHandle>(null);
  const [active, setActive] = useState<string>(LABELS[0]);
  const [labelInfo, setLabelInfo] = useState<LabelInfo[]>([]);

  useGSAP(
    () => {
      const story = createSnapStory(
        {
          section: sectionRef.current!,
          layers: gsap.utils.toArray<HTMLElement>(".sn-layer", layersRef.current),
          video: videoRef.current,
        },
        [...LABELS],
        VIDEO_LABEL,
        params,
        {
          onProgress: (p) => progressMeter.current?.set(p),
          onLabelChange: setActive,
          onLabelsBuilt: setLabelInfo,
          onSnapComplete: (progress, label) =>
            snapOut.current?.set(`${progress.toFixed(3)} ${label ? `= "${label}"` : "(entre labels)"}`),
        },
      );
      navigate.current = story.scrollToMoment;
      return () => story.mm.revert();
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
        ["snap", params.snapMode === "off" ? "off" : `snapTo: ${params.snapMode}`],
        ["directional", String(params.directional)],
        ["momentos", String(MOMENTS.length)],
        ["label atual", active],
      ]}
    >
      {/* seção pinada (trigger). As camadas internas é que animam. */}
      <div className="sn-section" ref={sectionRef}>
        <div className="sn-layers" ref={layersRef}>
          {MOMENTS.map((m) => (
            <div className={`sn-layer sn-layer--${m.kind}`} key={m.label}>
              {m.kind === "image" && (
                <img className="sn-media" src={m.src} alt={m.alt} width={1920} height={1200} loading="lazy" decoding="async" />
              )}
              {m.kind === "video" && (
                <video
                  ref={videoRef}
                  className="sn-media"
                  src={m.src}
                  poster={m.poster}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label={m.alt}
                />
              )}
              <div className="sn-copy">
                <span className="kicker">{m.kicker}</span>
                <p className="sn-title">{m.title}</p>
                <p className="sn-text">{m.text}</p>
              </div>
            </div>
          ))}
        </div>

        <nav className="sn-dots" aria-label="Momentos da história">
          {MOMENTS.map((m, i) => (
            <button
              type="button"
              key={m.label}
              className="sn-dot"
              aria-current={active === m.label ? "step" : undefined}
              onClick={() => navigate.current(i)}
            >
              <span className="sn-dot__n">{String(i + 1).padStart(2, "0")}</span>
              <span className="sn-dot__label">{m.label}</span>
            </button>
          ))}
        </nav>

        <div className="hud sn-hud">
          <span className="hud__title">snap</span>
          <Meter label="ScrollTrigger.progress" ref={progressMeter} />
          <Readout label="tl.currentLabel()" initial={active} />
          <Readout label="onSnapComplete" ref={snapOut} />
          <ul className="sn-labels">
            {labelInfo.map((l) => (
              <li key={l.name} className={l.name === active ? "is-active" : undefined}>
                <code>{l.name}</code>
                <span>{l.progress.toFixed(3)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AnimationSection>
  );
}
