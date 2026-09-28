/**
 * Moldura visual de UM exemplo:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ 01  FADE + SLIDE        │ O que observar      │  ← cabeçalho
 *   │ resumo · conceitos      │ 1. … 2. …           │
 *   ├──────────────────────────────────────────────┤
 *   │               palco (children)               │  ← elemento animado
 *   ├──────────────────────────────────────────────┤
 *   │ Configuração atual │ Código-fonte completo    │  ← código
 *   └──────────────────────────────────────────────┘
 *     [01 · start … · end … ]      [Parâmetros ▲]     ← dock fixo no rodapé
 *
 * Este componente NÃO anima nada: toda a lógica GSAP fica no arquivo
 * `animation.ts` de cada exemplo e no useGSAP do componente do exemplo.
 */
import { useId, useState, type ReactNode } from "react";
import type { Control, ExampleMeta, SummaryItem } from "../lab/types";
import type { LabParams } from "../lab/useLabParams";
import { CodeBlock } from "./CodeBlock";
import { ParameterPanel } from "./ParameterPanel";

type Props<P> = {
  meta: ExampleMeta;
  lab: LabParams<P>;
  controls: Control<P>[];
  /** Trecho de configuração gerado a partir dos parâmetros atuais */
  snippet: string;
  /** Código-fonte completo do animation.ts (importado com ?raw) */
  source: string;
  /** Valores exibidos na barra recolhida do dock */
  summary: SummaryItem[];
  /** Palco: o(s) elemento(s) animado(s) */
  children: ReactNode;
};

export function AnimationSection<P extends object>({ meta, lab, controls, snippet, source, summary, children }: Props<P>) {
  const titleId = useId();

  return (
    <section id={`example-${meta.number}`} className="example" aria-labelledby={titleId}>
      <header className="example__head wrap">
        <div className="example__num" aria-hidden="true">
          {meta.number}
        </div>
        <div className="example__intro">
          <ul className="cats" aria-label="Tipo de elemento">
            {meta.categories.map((c) => (
              <li key={c} data-cat={c}>
                {c}
              </li>
            ))}
          </ul>
          <h2 id={titleId} className="example__title">
            <span className="visually-hidden">Exemplo {meta.number}: </span>
            {meta.title}
          </h2>
          <p className="example__summary">{meta.summary}</p>
          <ul className="concepts" aria-label="Conceitos">
            {meta.concepts.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
        </div>
        <aside className="example__observe">
          <h3>O que observar</h3>
          <ol>
            {meta.observe.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </aside>
      </header>

      <div className="example__stage">{children}</div>

      <div className="example__code wrap">
        <div className="code-card">
          <div className="code-card__head">
            <span>Configuração atual</span>
            <span className="muted">atualiza quando você muda o painel</span>
          </div>
          <CodeBlock code={snippet} label={`Configuração atual do exemplo ${meta.number}`} />
        </div>
        <details className="code-card code-card--source">
          <summary className="code-card__head">
            <span>Código-fonte completo</span>
            <code className="muted">{meta.sourcePath}</code>
          </summary>
          <CodeBlock code={source} label={`Código-fonte do exemplo ${meta.number}`} />
        </details>
      </div>

      <ParameterDock meta={meta} lab={lab} controls={controls} summary={summary} />
    </section>
  );
}

type DockProps<P> = Pick<Props<P>, "meta" | "lab" | "controls" | "summary">;

function ParameterDock<P extends object>({ meta, lab, controls, summary }: DockProps<P>) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={`dock${open ? " is-open" : ""}`}>
      <div className="dock__inner">
        <div className="dock__bar">
          <a className="dock__num" href="#indice" title="Voltar ao índice">
            {meta.number}
          </a>
          <ul className="dock__summary" aria-label="Parâmetros atuais">
            {summary.map(([label, value]) => (
              <li key={label}>
                <span>{label}</span>
                <code>{value}</code>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn dock__toggle"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Fechar ▾" : "Parâmetros ▴"}
          </button>
        </div>
        <div id={panelId} className="dock__panel" hidden={!open}>
          <ParameterPanel lab={lab} controls={controls} />
        </div>
      </div>
    </div>
  );
}
