/**
 * ============================================================================
 * useLabParams — estado dos parâmetros de UM exemplo (UI do laboratório)
 * ============================================================================
 *
 * Guarda os valores do painel (`params`) e um contador `runId` usado pelo
 * botão "Recriar". Os exemplos passam `[lab.params, lab.runId]` como
 * dependências do useGSAP com `revertOnUpdate: true`, então:
 *
 *   1. você muda um parâmetro no painel
 *   2. o useGSAP REVERTE tudo o que aquele exemplo criou (tweens,
 *      ScrollTriggers, pins, estilos inline) — sem duplicatas
 *   3. o useGSAP roda a função de novo, criando a animação com os novos valores
 *   4. ESTE hook chama ScrollTrigger.sort() + ScrollTrigger.refresh()
 *
 * Por que o passo 4?
 *  - Um ScrollTrigger recriado vai para o FIM da lista interna do ScrollTrigger.
 *    A ordem importa: pins (ex.: exemplo 07) empurram o conteúdo abaixo deles,
 *    e o ScrollTrigger calcula as posições na ordem da lista.
 *    `ScrollTrigger.sort()` (sem argumentos) reordena por `refreshPriority` e
 *    depois pelo `start` de cada instância — ou seja, pela ordem na página.
 *  - Se você mudou o `end` de uma seção pinada, a altura do "pin-spacer" mudou
 *    e todas as posições abaixo ficaram desatualizadas. `ScrollTrigger.refresh()`
 *    recalcula tudo (é o mesmo que o ScrollTrigger faz sozinho no resize).
 *
 * Isso só é necessário porque, aqui, as animações são recriadas em tempo de
 * execução. Numa página comum (criada uma vez, de cima para baixo), o
 * ScrollTrigger já faz o refresh automaticamente no load e no resize.
 *
 * Docs: https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.sort()
 *       https://gsap.com/docs/v3/Plugins/ScrollTrigger/refresh()
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export type LabParams<P> = {
  params: P;
  runId: number;
  set: <K extends keyof P>(key: K, value: P[K]) => void;
  reset: () => void;
  replay: () => void;
};

export function useLabParams<P extends object>(defaults: P): LabParams<P> {
  const [params, setParams] = useState<P>(defaults);
  const [runId, setRunId] = useState(0);
  const isFirstRun = useRef(true);

  // useEffect roda DEPOIS do useGSAP (que usa useLayoutEffect), então quando
  // chegamos aqui a animação nova já existe.
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  }, [params, runId]);

  const set = useCallback(<K extends keyof P>(key: K, value: P[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setParams(defaults), [defaults]);
  const replay = useCallback(() => setRunId((n) => n + 1), []);

  return { params, runId, set, reset, replay };
}
