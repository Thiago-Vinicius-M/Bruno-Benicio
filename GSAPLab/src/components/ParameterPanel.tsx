/**
 * Painel de parâmetros genérico. Recebe uma lista de controles (schema) e o
 * estado do exemplo (useLabParams). Os controles são agrupados pelo "lugar"
 * onde o valor vive no código GSAP (scrollTrigger, tween, timeline...).
 *
 * Sliders e campos de texto só "confirmam" o valor quando você solta o slider
 * / aperta Enter / sai do campo — cada confirmação recria a animação e chama
 * ScrollTrigger.refresh(), então não faz sentido recriar a cada pixel arrastado.
 */
import { useId, useState } from "react";
import type { Control, ControlGroup, Primitive } from "../lab/types";
import type { LabParams } from "../lab/useLabParams";

const GROUP_LABEL: Record<ControlGroup, string> = {
  scrollTrigger: "scrollTrigger: { … }",
  tween: "tween vars",
  timeline: "timeline",
  stagger: "stagger: { … }",
  layout: "layout / CSS",
  debug: "debug",
};

const GROUP_ORDER: ControlGroup[] = ["scrollTrigger", "tween", "timeline", "stagger", "layout", "debug"];

function formatValue(value: unknown): string {
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}

type PanelProps<P> = {
  lab: LabParams<P>;
  controls: Control<P>[];
};

export function ParameterPanel<P extends object>({ lab, controls }: PanelProps<P>) {
  const groups = GROUP_ORDER.filter((g) => controls.some((c) => c.group === g));
  const commit = (key: keyof P, value: Primitive) => lab.set(key, value as P[keyof P]);

  return (
    <div className="panel">
      <div className="panel__groups">
        {groups.map((group) => (
          <fieldset key={group} className="panel__group">
            <legend>
              <code>{GROUP_LABEL[group]}</code>
            </legend>
            {controls
              .filter((c) => c.group === group)
              .map((control) => (
                <ControlRow
                  key={control.key}
                  control={control}
                  value={lab.params[control.key] as Primitive}
                  disabled={control.disabled?.(lab.params) ?? false}
                  onCommit={(v) => commit(control.key, v)}
                />
              ))}
          </fieldset>
        ))}
      </div>
      <div className="panel__actions">
        <button type="button" className="btn" onClick={lab.replay}>
          ↻ Recriar animação
        </button>
        <button type="button" className="btn btn--ghost" onClick={lab.reset}>
          Restaurar padrão
        </button>
      </div>
    </div>
  );
}

type RowProps<P> = {
  control: Control<P>;
  value: Primitive;
  disabled: boolean;
  onCommit: (value: Primitive) => void;
};

function ControlRow<P>({ control, value, disabled, onCommit }: RowProps<P>) {
  const id = useId();

  // "Rascunho" local: o slider/campo mostra o valor enquanto você mexe,
  // e só confirma (onCommit) no fim da interação.
  const [draft, setDraft] = useState<Primitive>(value);
  const [prevValue, setPrevValue] = useState<Primitive>(value);
  if (value !== prevValue) {
    // valor mudou por fora (ex.: "Restaurar padrão") → sincroniza o rascunho
    setPrevValue(value);
    setDraft(value);
  }
  const commitDraft = () => {
    if (draft !== value) onCommit(draft);
  };

  const shownValue =
    control.type === "range" ? `${draft}${control.unit ?? ""}` : control.type === "toggle" ? String(value) : formatValue(draft);

  return (
    <div className={`ctl ctl--${control.type}${disabled ? " is-disabled" : ""}`}>
      <div className="ctl__head">
        <label className="ctl__label" htmlFor={id}>
          {control.label}
        </label>
        <output className="ctl__value" htmlFor={id}>
          {shownValue}
        </output>
      </div>

      {control.type === "range" && (
        <input
          id={id}
          type="range"
          min={control.min}
          max={control.max}
          step={control.step}
          value={Number(draft)}
          disabled={disabled}
          onChange={(e) => setDraft(Number(e.target.value))}
          onPointerUp={commitDraft}
          onKeyUp={commitDraft}
          onBlur={commitDraft}
        />
      )}

      {control.type === "select" && (
        <select
          id={id}
          value={String(control.options.findIndex((o) => o.value === value))}
          disabled={disabled}
          onChange={(e) => onCommit(control.options[Number(e.target.value)].value)}
        >
          {control.options.map((option, i) => (
            <option key={option.label} value={i}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {control.type === "toggle" && (
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(e) => onCommit(e.target.checked)}
        />
      )}

      {control.type === "text" && (
        <>
          <input
            id={id}
            type="text"
            spellCheck={false}
            autoComplete="off"
            list={control.suggestions ? `${id}-list` : undefined}
            value={String(draft)}
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commitDraft()}
            onBlur={commitDraft}
          />
          {control.suggestions && (
            <datalist id={`${id}-list`}>
              {control.suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
        </>
      )}

      {control.hint && <p className="ctl__hint">{control.hint}</p>}
    </div>
  );
}
