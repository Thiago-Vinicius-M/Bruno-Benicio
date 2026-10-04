"use client";

import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@/animations/gsap";
import { createScreenTransition } from "@/animations/screenTransition";
import { EXPERIENCE_TRANSITION } from "./experienceTransition";
import { EXPERIENCES, type ExperienceId } from "./experiences";
import styles from "./Experience.module.css";

const TITLE_ID = "subtela-titulo";

const homeElements = () => Array.from(document.querySelectorAll<HTMLElement>("[data-experience-home]"));

type ExperienceLayerProps = {
  /** subtela pedida (null = Home) */
  active: ExperienceId | null;
  onClose: () => void;
};

/**
 * Camada da subtela, fixa sobre a página. Só existe no DOM enquanto uma subtela está aberta
 * (ou animando): ao fechar, a transição volta ao contrário e só então o conteúdo é removido.
 *
 * Enquanto aberta: a Home fica inerte (sem foco/clique/leitor de tela), a página não rola
 * por trás, Esc volta, e o foco vai para a subtela — e volta para o botão que a abriu.
 */
export function ExperienceLayer({ active, onClose }: ExperienceLayerProps) {
  // Subtela renderizada — continua montada durante a animação de volta.
  const [shown, setShown] = useState(active);
  if (active && active !== shown) setShown(active);
  const isOpen = shown !== null;

  const layerRef = useRef<HTMLDivElement>(null);
  const transitionRef = useRef<ReturnType<typeof createScreenTransition>>(null);

  useGSAP(
    () => {
      if (!isOpen) return;
      const layer = layerRef.current!;
      const transition = createScreenTransition(
        {
          home: homeElements(),
          screen: layer,
          items: Array.from(layer.querySelectorAll<HTMLElement>("[data-experience-item]")),
        },
        EXPERIENCE_TRANSITION,
        () => setShown(null),
      );
      transitionRef.current = transition;
      return () => {
        transition.mm.revert();
        transitionRef.current = null;
      };
    },
    { dependencies: [isOpen, EXPERIENCE_TRANSITION], revertOnUpdate: true },
  );

  // Abrir toca a transição; fechar volta ao contrário e, no fim, desmonta a subtela
  // (setShown(null) acima). Reabrir durante a volta só toca para frente de novo.
  useEffect(() => {
    if (active) transitionRef.current?.open();
    else transitionRef.current?.close();
  }, [active, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement;
    const home = homeElements();
    const root = document.documentElement;

    for (const el of home) el.inert = true;
    root.style.overflow = "hidden";
    root.style.scrollbarGutter = "stable"; // sem a barra de rolagem, nada "pula" de lado
    layerRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      for (const el of home) el.inert = false;
      root.style.overflow = "";
      root.style.scrollbarGutter = "";
      if (opener instanceof HTMLElement) opener.focus({ preventScroll: true });
    };
  }, [isOpen, onClose]);

  if (!shown) return null;
  const { title, Content } = EXPERIENCES[shown];

  return (
    <div
      ref={layerRef}
      className={styles.layer}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      tabIndex={-1}
    >
      <div className={styles.scroller}>
        <div className={styles.bar}>
          <button type="button" className={styles.back} onClick={onClose} data-experience-item>
            <span aria-hidden="true">←</span> Voltar
          </button>
        </div>

        <div className={`container ${styles.body}`}>
          <h2 id={TITLE_ID} className="type-title" data-experience-item>
            {title}
          </h2>
          <Content />
          <button type="button" className={`${styles.back} ${styles.backEnd}`} onClick={onClose}>
            <span aria-hidden="true">←</span> Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
