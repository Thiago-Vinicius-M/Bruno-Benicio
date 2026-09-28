/**
 * Pequenos mostradores (HUD) usados dentro dos palcos dos exemplos.
 *
 * Eles são atualizados A CADA FRAME pelos callbacks do ScrollTrigger
 * (onUpdate etc.). Atualizar estado do React 60x por segundo causaria
 * re-renderizações desnecessárias — então cada mostrador expõe um método
 * imperativo `set()` (via ref) que escreve direto no DOM. É o mesmo princípio
 * do GSAP: mexer só no que mudou, sem re-render.
 */
import { useImperativeHandle, useRef, type Ref } from "react";

export type MeterHandle = { set: (progress: number, text?: string) => void };
export type ReadoutHandle = { set: (text: string) => void };

type MeterProps = { label: string; ref?: Ref<MeterHandle>; tone?: "accent" | "alt" };

/** Barra de progresso 0 → 1 com valor numérico */
export function Meter({ label, ref, tone = "accent" }: MeterProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);

  useImperativeHandle(ref, () => ({
    set(progress, text) {
      rootRef.current?.style.setProperty("--p", String(Math.min(1, Math.max(0, progress))));
      if (valueRef.current) valueRef.current.textContent = text ?? progress.toFixed(3);
    },
  }));

  return (
    <div className={`meter meter--${tone}`} ref={rootRef}>
      <span className="meter__label">{label}</span>
      <span className="meter__value" ref={valueRef}>
        0.000
      </span>
      <span className="meter__track">
        <span className="meter__fill" />
      </span>
    </div>
  );
}

type ReadoutProps = { label: string; initial?: string; ref?: Ref<ReadoutHandle> };

/**
 * Par rótulo/valor em texto. Use OU `initial` controlado pelo React (valores
 * que mudam só quando os parâmetros mudam) OU `ref.set()` (valores por frame)
 * — não os dois no mesmo Readout.
 */
export function Readout({ label, initial = "—", ref }: ReadoutProps) {
  const valueRef = useRef<HTMLSpanElement>(null);

  useImperativeHandle(ref, () => ({
    set(text) {
      if (valueRef.current) valueRef.current.textContent = text;
    },
  }));

  return (
    <div className="readout">
      <span className="readout__label">{label}</span>
      <span className="readout__value" ref={valueRef}>
        {initial}
      </span>
    </div>
  );
}
