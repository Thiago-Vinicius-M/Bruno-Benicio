import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { AnimationSection } from "../../components/AnimationSection";
import { EASE_OPTIONS, END_SUGGESTIONS, START_SUGGESTIONS, TOGGLE_ACTIONS_OPTIONS } from "../../lab/options";
import type { Control, ExampleProps } from "../../lab/types";
import { useLabParams } from "../../lab/useLabParams";
import { createFadeSlide, FADE_SLIDE_DEFAULTS, type FadeSlideParams, type ToggleCallbackName } from "./animation";
import source from "./animation.ts?raw";
import "./styles.css";

const CONTROLS: Control<FadeSlideParams>[] = [
  {
    type: "text",
    key: "start",
    label: "start",
    group: "scrollTrigger",
    suggestions: START_SUGGESTIONS,
    hint: '"ponto do trigger" + "linha da viewport". Enter aplica.',
  },
  {
    type: "text",
    key: "end",
    label: "end",
    group: "scrollTrigger",
    suggestions: END_SUGGESTIONS,
    hint: "Sem scrub, o end só marca onde disparam onLeave / onEnterBack.",
  },
  {
    type: "select",
    key: "toggleActions",
    label: "toggleActions",
    group: "scrollTrigger",
    options: TOGGLE_ACTIONS_OPTIONS,
    hint: "Ordem: onEnter · onLeave · onEnterBack · onLeaveBack",
  },
  { type: "range", key: "y", label: "y (distância inicial)", group: "tween", min: 0, max: 400, step: 10, unit: "px" },
  { type: "range", key: "duration", label: "duration", group: "tween", min: 0.1, max: 3, step: 0.1, unit: "s" },
  { type: "select", key: "ease", label: "ease", group: "tween", options: EASE_OPTIONS },
  { type: "toggle", key: "markers", label: "markers", group: "debug" },
];

function toSnippet(p: FadeSlideParams) {
  return `gsap.from(content, {
  y: ${p.y},              // mobile: ${Math.round(p.y * 0.6)}
  opacity: 0,
  duration: ${p.duration},
  ease: "${p.ease}",
  scrollTrigger: {
    trigger: block,       // o bloco tracejado (não anima)
    start: "${p.start}",
    end: "${p.end}",
    toggleActions: "${p.toggleActions}",
    markers: ${p.markers},
  },
});`;
}

const CALLBACK_HELP: [ToggleCallbackName, string][] = [
  ["onEnter", "desceu e cruzou o start"],
  ["onLeave", "desceu e cruzou o end"],
  ["onEnterBack", "subiu e cruzou o end"],
  ["onLeaveBack", "subiu e cruzou o start"],
];

type LogEntry = { id: number; name: ToggleCallbackName; action: string };

export function Example01FadeSlide({ meta }: ExampleProps) {
  const lab = useLabParams(FADE_SLIDE_DEFAULTS);
  const { params } = lab;

  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const nextLogId = useRef(0);

  useGSAP(
    () => {
      const mm = createFadeSlide({ trigger: triggerRef.current!, content: contentRef.current! }, params, {
        onEvent: (name, action) => {
          nextLogId.current += 1;
          const entry = { id: nextLogId.current, name, action };
          setLog((prev) => [entry, ...prev].slice(0, 6));
        },
      });
      // Cleanup: o useGSAP já reverte o que foi criado aqui dentro, mas
      // devolver mm.revert() deixa explícito quem desfaz o matchMedia.
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
        ["start", params.start],
        ["end", params.end],
        ["toggleActions", params.toggleActions],
        ["y", `${params.y}px`],
      ]}
    >
      <div className="fs-stage wrap">
        <div className="fs-track">
          <div className="fs-trigger is-trigger" ref={triggerRef} data-label="trigger · não anima">
            <div className="fs-content" ref={contentRef}>
              <p className="kicker">gsap.from() · toggleActions</p>
              <h3 className="fs-title">01 — Fade + Slide</h3>
              <p className="fs-text">
                Eu começo <strong>{params.y}px</strong> abaixo e com <code>opacity: 0</code>. Quando o topo do bloco
                tracejado cruza a linha <code>{params.start}</code>, toco sozinho em <strong>{params.duration}s</strong>{" "}
                com <code>{params.ease}</code>. O scroll só aperta o “play”.
              </p>
            </div>
          </div>
        </div>

        <aside className="fs-log">
          <h4 className="fs-log__title">Callbacks → ação executada</h4>
          <p className="fs-log__speed">
            velocidade média ≈ <strong>{Math.round(params.y / params.duration)} px/s</strong>{" "}
            <span className="muted">(y ÷ duration)</span>
          </p>
          <ol className="fs-log__list">
            {log.length === 0 ? (
              <li className="muted">Role até o bloco tracejado…</li>
            ) : (
              log.map((entry) => (
                <li key={entry.id}>
                  <code>{entry.name}</code>
                  <span aria-hidden="true">→</span>
                  <strong data-action={entry.action}>{entry.action}</strong>
                </li>
              ))
            )}
          </ol>
          <dl className="fs-log__legend">
            {CALLBACK_HELP.map(([name, help]) => (
              <div key={name}>
                <dt>
                  <code>{name}</code>
                </dt>
                <dd>{help}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </AnimationSection>
  );
}
