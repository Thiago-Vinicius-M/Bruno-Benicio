import { useRef, useState, type CSSProperties } from "react";
import { useGSAP } from "@gsap/react";
import { AnimationSection } from "../../components/AnimationSection";
import { Meter, Readout, type MeterHandle, type ReadoutHandle } from "../../components/Hud";
import { EASE_OPTIONS, SCRUB_OPTIONS } from "../../lab/options";
import type { Control, ControlOption, ExampleProps } from "../../lab/types";
import { useLabParams } from "../../lab/useLabParams";
import {
  CINEMATIC_DEFAULTS,
  createCinematicTimeline,
  type CinematicParams,
  type TimelineSegment,
} from "./animation";
import source from "./animation.ts?raw";
import "./styles.css";

const POSITION_OPTIONS: ControlOption[] = [
  { label: '">"  fim do anterior', value: ">" },
  { label: '"<"  junto com o anterior', value: "<" },
  { label: '"+=0.5"  pausa de 0.5s', value: "+=0.5" },
  { label: '"+=1"  pausa de 1s', value: "+=1" },
  { label: '"-=0.5"  sobrepõe 0.5s', value: "-=0.5" },
  { label: '"<0.5"  0.5s após início do anterior', value: "<0.5" },
  { label: '">-0.25"  0.25s antes do fim do anterior', value: ">-0.25" },
];

const CONTROLS: Control<CinematicParams>[] = [
  { type: "select", key: "pos2", label: "passo 2 · imagem aparece", group: "timeline", options: POSITION_OPTIONS },
  { type: "select", key: "pos3", label: "passo 3 · imagem aumenta", group: "timeline", options: POSITION_OPTIONS },
  { type: "select", key: "pos4", label: "passo 4 · texto muda", group: "timeline", options: POSITION_OPTIONS },
  { type: "select", key: "pos5", label: "passo 5 · legenda aparece", group: "timeline", options: POSITION_OPTIONS },
  { type: "select", key: "pos6", label: "passo 6 · imagem reduz", group: "timeline", options: POSITION_OPTIONS },
  {
    type: "select",
    key: "ease",
    label: "defaults.ease",
    group: "timeline",
    options: EASE_OPTIONS,
    hint: "Herdado por todos os tweens da timeline.",
  },
  {
    type: "range",
    key: "screens",
    label: "end (+= telas)",
    group: "scrollTrigger",
    min: 2,
    max: 8,
    step: 0.5,
    unit: " telas",
    hint: "Mesma timeline, mais scroll = cada “segundo” vale mais pixels.",
  },
  { type: "select", key: "scrub", label: "scrub", group: "scrollTrigger", options: SCRUB_OPTIONS },
  { type: "toggle", key: "markers", label: "markers", group: "debug" },
];

function toSnippet(p: CinematicParams) {
  return `const tl = gsap.timeline({
  defaults: { ease: "${p.ease}", duration: 1 },
  scrollTrigger: {
    trigger: stage, pin: true,
    start: "top top",
    end: () => "+=" + innerHeight * ${p.screens},
    scrub: ${p.scrub},
    invalidateOnRefresh: true,
  },
});

tl.from(title, { yPercent: 60, autoAlpha: 0 })                        // 1
  .fromTo(media, { autoAlpha: 0, clipPath: "inset(18% … round 24px)" },
                 { autoAlpha: 1, clipPath: "inset(0% … round 24px)" }, "${p.pos2}")  // 2
  .to(media, { scale: 1, duration: 1.5 }, "${p.pos3}")                   // 3
  .to(title, { y: () => -stage.clientHeight * 0.36, scale: 0.42 }, "${p.pos4}") // 4
  .fromTo(caption, { autoAlpha: 0, y: 40 },
                   { autoAlpha: 1, y: 0, duration: 0.8 }, "${p.pos5}")  // 5
  .to(media, { scale: 0.58, xPercent: -20 }, "${p.pos6}");               // 6`;
}

type Built = { segments: TimelineSegment[]; total: number };

export function Example08CinematicTimeline({ meta }: ExampleProps) {
  const lab = useLabParams(CINEMATIC_DEFAULTS);
  const { params } = lab;

  const stageRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const progressMeter = useRef<MeterHandle>(null);
  const timeOut = useRef<ReadoutHandle>(null);
  const [built, setBuilt] = useState<Built | null>(null);

  useGSAP(
    () => {
      const mm = createCinematicTimeline(
        { stage: stageRef.current!, title: titleRef.current!, media: mediaRef.current!, caption: captionRef.current! },
        params,
        {
          onBuilt: (segments, total) => setBuilt({ segments, total }),
          onProgress: (p) => progressMeter.current?.set(p),
          onTime: (time, duration) => {
            timeOut.current?.set(`${time.toFixed(2)}s de ${duration.toFixed(2)}s`);
            rulerRef.current?.style.setProperty("--p", String(duration ? time / duration : 0));
          },
        },
      );
      return () => mm.revert();
    },
    { dependencies: [params, lab.runId], revertOnUpdate: true },
  );

  const total = built?.total ?? 1;
  const ticks = Array.from({ length: Math.floor(total) + 1 }, (_, i) => i);

  return (
    <AnimationSection
      meta={meta}
      lab={lab}
      controls={CONTROLS}
      snippet={toSnippet(params)}
      source={source}
      summary={[
        ["posições", [params.pos2, params.pos3, params.pos4, params.pos5, params.pos6].join("  ")],
        ["tl.duration()", built ? `${total.toFixed(2)}s` : "—"],
        ["end", `+= ${params.screens} telas`],
      ]}
    >
      {/* Palco pinado: trigger + pin. Só os filhos são animados. */}
      <div className="cn-stage" ref={stageRef}>
        <div className="cn-media" ref={mediaRef}>
          <img
            src="/media/images/cinematic-city.webp"
            alt="Cidade vista do alto ao pôr do sol, com arranha-céus e um lago no horizonte."
            width={1920}
            height={1200}
            loading="lazy"
            decoding="async"
          />
        </div>

        <h3 className="cn-title" ref={titleRef}>
          Uma timeline,
          <br />
          um ScrollTrigger.
        </h3>

        <div className="cn-caption" ref={captionRef}>
          <span className="kicker">passo 5 · outro elemento</span>
          <p>
            Seis tweens em sequência, posicionados uns em relação aos outros. Mude o <code>position parameter</code> no
            painel e veja a régua abaixo se reorganizar.
          </p>
        </div>

        <div className="cn-ruler-wrap">
          <div className="cn-ruler" ref={rulerRef} role="img" aria-label="Régua da timeline com os seis tweens">
            {built?.segments.map((s) => (
              <div
                className="cn-seg"
                key={s.label}
                style={{ "--l": s.start / total, "--w": s.duration / total } as CSSProperties}
              >
                <span className="cn-seg__label">{s.label}</span>
                <span className="cn-seg__track">
                  <span className="cn-seg__bar" />
                </span>
              </div>
            ))}
            <div className="cn-ticks" aria-hidden="true">
              {ticks.map((t) => (
                <span key={t} style={{ "--l": t / total } as CSSProperties}>
                  {t}s
                </span>
              ))}
            </div>
            <span className="cn-playhead" aria-hidden="true" />
          </div>
          <div className="hud cn-hud">
            <Meter label="ScrollTrigger.progress" ref={progressMeter} />
            <Readout label="tl.time()" ref={timeOut} />
          </div>
        </div>
      </div>
    </AnimationSection>
  );
}
