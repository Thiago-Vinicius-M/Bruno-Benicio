"use client";

import { useEffect, useState } from "react";

/**
 * Qual seção está na tela agora — o id da última seção cujo topo já passou de uma linha
 * imaginária a ACTIVATION_LINE da altura da tela.
 *
 * Entre duas seções (ex.: o Marquee, que não tem id) a anterior continua ativa. No fim da
 * página a última seção é ativada mesmo que o topo dela não alcance a linha (seção curta).
 * Ids sem elemento na página (ex.: #agenda) são ignorados.
 *
 * Só leituras de layout (getBoundingClientRect), no máximo uma vez por frame.
 */
const ACTIVATION_LINE = 0.35;

export function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const sections = ids
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => el !== null);
      if (!sections.length) return;

      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const line = window.innerHeight * ACTIVATION_LINE;
      let current = sections[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) current = section;
      }
      setActive(atBottom ? sections[sections.length - 1].id : current.id);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ids]);

  return active;
}
