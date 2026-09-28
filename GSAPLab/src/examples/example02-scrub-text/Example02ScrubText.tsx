import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { AnimationSection } from "../../components/AnimationSection";
import { Meter, Readout, type MeterHandle, type ReadoutHandle } from "../../components/Hud";
import { EASE_OPTIONS, END_SUGGESTIONS, START_SUGGESTIONS } from "../../lab/options";
import type { Control, ExampleProps } from "../../lab/types";
import { useLabParams } from "../../lab/useLabParams";
import { createScrubText, resolveScrub, SCRUB_TEXT_DEFAULTS, type ScrubTextParams } from "./animation";
import source from "./animation.ts?raw";
import "./styles.css";

const CONTROLS: Control<ScrubTextParams>[] = [
  {
    type: "select",
    key: "scrubMode",
    label: "scrub",
    group: "scrollTrigger",
    options: [
      { label: "false — só dispara", value: "false" },
      { label: "true — grudado no scroll", value: "true" },
      { label: "número — suavizado", value: "number" },
    ],
  },
  {
    type: "range",
    key: "scrubAmount",
    label: "scrub (segundos)",
    group: "scrollTrigger",
    min: 0.1,
    max: 4,
    step: 0.1,
    unit: "s",
    hint: "Tempo que o playhead leva para alcançar a barra de rolagem.",
    disabled: (p) => p.scrubMode !== "number",
  },
  { type: "text", key: "start", label: "start", group: "scrollTrigger", suggestions: START_SUGGESTIONS },
  { type: "text", key: "end", label: "end", group: "scrollTrigger", suggestions: END_SUGGESTIONS },
  { type: "range", key: "fromX", label: "x inicial", group: "tween", min: -1000, max: 0, step: 50, unit: "px" },
  { type: "range", key: "toX", label: "x final", group: "tween", min: 0, max: 1000, step: 50, unit: "px" },
  {
    type: "select",
    key: "ease",
    label: "ease",
    group: "tween",
    options: EASE_OPTIONS,
    hint: 'Com scrub, "none" = relação linear entre scroll e movimento.',
  },
  {
    type: "range",
    key: "duration",
    label: "duration",
    group: "tween",
    min: 0.2,
    max: 4,
    step: 0.1,
    unit: "s",
    hint: "Só importa com scrub: false. Com scrub, a animação é esticada entre start e end.",
    disabled: (p) => p.scrubMode !== "false",
  },
  { type: "toggle", key: "markers", label: "markers", group: "debug" },
];

function toSnippet(p: ScrubTextParams) {
  const scrub = resolveScrub(p);
  return `gsap.fromTo(line,
  { x: ${p.fromX} },          // progress 0  (mobile: ×0.5)
  {
    x: ${p.toX},               // progress 1
    ease: "${p.ease}",${p.scrubMode === "false" ? `\n    duration: ${p.duration},` : ""}
    scrollTrigger: {
      trigger: stage,
      start: "${p.start}",
      end: "${p.end}",
      scrub: ${String(scrub)},${p.scrubMode === "false" ? `\n      toggleActions: "play reverse play reverse",` : ""}
      markers: ${p.markers},
    },
  },
);`;
}

export function Example02ScrubText({ meta }: ExampleProps) {
  const lab = useLabParams(SCRUB_TEXT_DEFAULTS);
  const { params } = lab;

  const triggerRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const scrollMeter = useRef<MeterHandle>(null);
  const playMeter = useRef<MeterHandle>(null);
  const directionOut = useRef<ReadoutHandle>(null);
  const xOut = useRef<ReadoutHandle>(null);

  useGSAP(
    () => {
      const mm = createScrubText({ trigger: triggerRef.current!, line: lineRef.current! }, params, {
        onScroll: (progress, direction) => {
          scrollMeter.current?.set(progress);
          directionOut.current?.set(direction === 1 ? "1 (descendo)" : "-1 (subindo)");
        },
        onPlayhead: (progress, x) => {
          playMeter.current?.set(progress);
          xOut.current?.set(`${x.toFixed(1)}px`);
        },
      });
      return () => mm.revert();
    },
    { dependencies: [params, lab.runId], revertOnUpdate: true },
  );

  const scrub = resolveScrub(params);

  return (
    <AnimationSection
      meta={meta}
      lab={lab}
      controls={CONTROLS}
      snippet={toSnippet(params)}
      source={source}
      summary={[
        ["scrub", String(scrub)],
        ["x", `${params.fromX} → ${params.toX}`],
        ["start", params.start],
        ["end", params.end],
      ]}
    >
      <div className="st-stage is-trigger" ref={triggerRef} data-label="trigger · stage inteiro">
        <div className="wrap">
          <p className="st-note">
            O texto abaixo cruza a tela enquanto este palco está visível. Compare as duas barras do HUD: com{" "}
            <code>scrub: true</code> elas andam juntas; com <code>scrub: 2</code> a do playhead chega atrasada.
          </p>
        </div>

        <div className="st-lines" aria-hidden="true">
          <p className="st-line st-line--ghost">SCROLL CONTROLA O PLAYHEAD</p>
          <p className="st-line" ref={lineRef}>
            SCROLL CONTROLA O PLAYHEAD
          </p>
        </div>
        <p className="visually-hidden">Scroll controla o playhead</p>
        <div className="wrap">
          <p className="st-legend muted">Linha contornada = posição original (x: 0). Linha sólida = elemento animado.</p>
        </div>

        <div className="st-hud-wrap">
          <div className="hud st-hud">
            <span className="hud__title">scrub: {String(scrub)}</span>
            <Meter label="ScrollTrigger.progress (scroll)" ref={scrollMeter} />
            <Meter label="tween.progress() (playhead)" tone="alt" ref={playMeter} />
            <Readout label="self.direction" ref={directionOut} />
            <Readout label="x atual" ref={xOut} />
          </div>
        </div>
      </div>
    </AnimationSection>
  );
}
