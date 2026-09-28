import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { AnimationSection } from "../../components/AnimationSection";
import { EASE_OPTIONS, START_SUGGESTIONS, TOGGLE_ACTIONS_OPTIONS } from "../../lab/options";
import type { Control, ExampleProps } from "../../lab/types";
import { useLabParams } from "../../lab/useLabParams";
import { createTextStagger, TEXT_STAGGER_DEFAULTS, type TextStaggerParams } from "./animation";
import source from "./animation.ts?raw";
import "./styles.css";

const PHRASE = "SCROLL CHANGES EVERYTHING";

const CONTROLS: Control<TextStaggerParams>[] = [
  { type: "text", key: "start", label: "start", group: "scrollTrigger", suggestions: START_SUGGESTIONS },
  { type: "select", key: "toggleActions", label: "toggleActions", group: "scrollTrigger", options: TOGGLE_ACTIONS_OPTIONS },
  {
    type: "select",
    key: "split",
    label: "alvos (query)",
    group: "stagger",
    options: [
      { label: "palavras (3 alvos)", value: "words" },
      { label: "letras (23 alvos)", value: "chars" },
    ],
    hint: "Com letras, from: center / edges / random ficam bem mais visíveis.",
  },
  {
    type: "select",
    key: "staggerMode",
    label: "modo",
    group: "stagger",
    options: [
      { label: "each — intervalo fixo", value: "each" },
      { label: "amount — tempo total", value: "amount" },
    ],
  },
  { type: "range", key: "staggerValue", label: "valor", group: "stagger", min: 0, max: 1.5, step: 0.05, unit: "s" },
  {
    type: "select",
    key: "from",
    label: "from (direção)",
    group: "stagger",
    options: ["start", "center", "end", "edges", "random"].map((v) => ({ label: v, value: v })),
  },
  { type: "range", key: "yPercent", label: "yPercent inicial", group: "tween", min: 0, max: 150, step: 10, unit: "%" },
  { type: "range", key: "rotation", label: "rotation inicial", group: "tween", min: -30, max: 30, step: 1, unit: "°" },
  { type: "range", key: "duration", label: "duration (cada alvo)", group: "tween", min: 0.1, max: 2, step: 0.1, unit: "s" },
  { type: "select", key: "ease", label: "ease", group: "tween", options: EASE_OPTIONS },
  { type: "toggle", key: "markers", label: "markers", group: "debug" },
];

function toSnippet(p: TextStaggerParams) {
  const stagger =
    p.staggerMode === "each" && p.from === "start"
      ? `${p.staggerValue},               // atalho de { each: ${p.staggerValue} }`
      : `{ ${p.staggerMode}: ${p.staggerValue}, from: "${p.from}" },`;
  return `const targets = gsap.utils.toArray(".js-stagger-target", container);
// → ${p.split === "words" ? "3 palavras" : "23 letras"}

gsap.from(targets, {
  yPercent: ${p.yPercent},
  rotation: ${p.rotation},          // mobile: ${p.rotation / 2}
  opacity: 0,
  duration: ${p.duration},         // duração de CADA alvo
  ease: "${p.ease}",
  stagger: ${stagger}
  scrollTrigger: {
    trigger: container,
    start: "${p.start}",
    toggleActions: "${p.toggleActions}",
    markers: ${p.markers},
  },
});`;
}

type Info = { targets: number; totalDuration: number };

export function Example03TextStagger({ meta }: ExampleProps) {
  const lab = useLabParams(TEXT_STAGGER_DEFAULTS);
  const { params } = lab;
  const containerRef = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState<Info | null>(null);

  useGSAP(
    () => {
      const mm = createTextStagger({ container: containerRef.current! }, params, { onCreated: setInfo });
      return () => mm.revert();
    },
    { dependencies: [params, lab.runId], revertOnUpdate: true },
  );

  const n = info?.targets ?? (params.split === "words" ? 3 : 23);
  const gap = params.staggerMode === "each" ? params.staggerValue : n > 1 ? params.staggerValue / (n - 1) : 0;
  const spread = params.staggerMode === "each" ? params.staggerValue * (n - 1) : params.staggerValue;

  return (
    <AnimationSection
      meta={meta}
      lab={lab}
      controls={CONTROLS}
      snippet={toSnippet(params)}
      source={source}
      summary={[
        ["stagger", `{ ${params.staggerMode}: ${params.staggerValue}, from: "${params.from}" }`],
        ["alvos", params.split === "words" ? "palavras" : "letras"],
        ["start", params.start],
      ]}
    >
      <div className="sg-stage wrap">
        <div className="sg-block is-trigger" ref={containerRef} data-label="trigger · container (escopo da query)">
          <h3 className="sg-phrase" aria-label={PHRASE}>
            {PHRASE.split(" ").map((word) => (
              <span className="sg-mask" key={word} aria-hidden="true">
                {params.split === "words" ? (
                  <span className="sg-word js-stagger-target">{word}</span>
                ) : (
                  <span className="sg-word">
                    {[...word].map((char, i) => (
                      <span key={i} className="sg-char js-stagger-target">
                        {char}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            ))}
          </h3>
        </div>

        <dl className="sg-facts">
          <div>
            <dt>alvos encontrados</dt>
            <dd>{n}</dd>
          </div>
          <div>
            <dt>intervalo entre alvos</dt>
            <dd>
              {gap.toFixed(3)}s <span className="muted">{params.staggerMode === "amount" ? "(amount ÷ (n−1))" : "(each)"}</span>
            </dd>
          </div>
          <div>
            <dt>escalonamento total</dt>
            <dd>
              {spread.toFixed(2)}s{" "}
              <span className="muted">
                {params.staggerMode === "each" ? "(each × (n−1))" : "(amount)"}
                {params.from === "center" || params.from === "edges" ? " · ~metade com center/edges" : ""}
              </span>
            </dd>
          </div>
          <div>
            <dt>tween.duration()</dt>
            <dd>{info ? `${info.totalDuration.toFixed(2)}s` : "—"}</dd>
          </div>
        </dl>
      </div>
    </AnimationSection>
  );
}
