"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { onPageReady } from "@/lib/pageReady";
import { ExperienceContext } from "./experienceContext";
import { ExperienceLayer } from "./ExperienceLayer";
import { EXPERIENCES, experienceFromHash, type ExperienceId } from "./experiences";

/**
 * Navegação Home ↔ subtelas (experiences.tsx). Cada subtela tem um hash próprio na URL:
 *   · abrir empilha uma entrada no histórico → o "voltar" do navegador/celular fecha a subtela
 *   · a página aberta já com o hash (link direto) abre a subtela depois do loading
 *
 * A Home é o que estiver marcado com `data-experience-home` (header e main): ela sai de
 * cena e fica inerte enquanto a subtela está aberta (ExperienceLayer).
 */
export function ExperienceProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ExperienceId | null>(null);

  const open = useCallback((id: ExperienceId) => {
    const { hash } = EXPERIENCES[id];
    if (location.hash !== hash) history.pushState({ experience: id }, "", hash);
    setActive(id);
  }, []);

  const close = useCallback(() => {
    // Aberta por aqui: volta a entrada do histórico (o popstate devolve a Home).
    // Aberta por link direto: não há para onde voltar — só tira o hash da URL.
    if (history.state?.experience) {
      history.back();
      return;
    }
    history.replaceState(history.state, "", location.pathname + location.search);
    setActive(null);
  }, []);

  useEffect(() => {
    const sync = () => setActive(experienceFromHash(location.hash));
    window.addEventListener("popstate", sync);
    const cancel = onPageReady(sync);
    return () => {
      window.removeEventListener("popstate", sync);
      cancel();
    };
  }, []);

  const api = useMemo(() => ({ active, open, close }), [active, open, close]);

  return (
    <ExperienceContext value={api}>
      {children}
      <ExperienceLayer active={active} onClose={close} />
    </ExperienceContext>
  );
}
