/**
 * Página única do laboratório: cabeçalho → exemplos (na ordem do registro) → rodapé.
 */
import { useEffect } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EXAMPLES } from "../lab/registry";
import { LabFooter } from "./LabFooter";
import { LabHeader } from "./LabHeader";

export function ScrollLab() {
  // Web fonts mudam a altura dos textos quando terminam de carregar → todas
  // as posições start/end calculadas antes ficariam erradas. O ScrollTrigger
  // já faz refresh no evento "load" da janela, mas as fontes podem terminar
  // depois dele; por isso pedimos um refresh quando document.fonts estiver pronto.
  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) ScrollTrigger.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <LabHeader examples={EXAMPLES} />
      <main>
        {EXAMPLES.map(({ meta, Component }) => (
          <Component key={meta.number} meta={meta} />
        ))}
      </main>
      <LabFooter />
    </>
  );
}
