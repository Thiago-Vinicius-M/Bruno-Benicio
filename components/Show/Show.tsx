"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/animations/gsap";
import { createFadeSlide } from "@/animations/fadeSlide";
import {
  formatPrice,
  SHOW_INCLUDES,
  SHOW_PACKAGES,
  SHOW_REPERTOIRE,
} from "./showContent";
import { SHOW_REVEAL } from "./showReveal";
import styles from "./Show.module.css";

type RevealGroup = "heading" | "packages" | "details";

/**
 * Seção NOSSO SHOW: orçamento de shows — formatos com preço, repertório e estrutura
 * (showContent.ts). O contato para contratar fica na seção CONTATO. Mesma tipografia, cores e divisórias da
 * seção MÚSICAS; entrada com o mesmo fade + slide.
 */
export function Show() {
  const stageRef = useRef<HTMLDivElement>(null);

  // O stage é o trigger (não é animado); os alvos são marcados com data-reveal no JSX.
  useGSAP(
    () => {
      const stage = stageRef.current!;
      const group = (name: RevealGroup) => gsap.utils.toArray<HTMLElement>(`[data-reveal="${name}"]`, stage);

      const { heading, packages, details, ...params } = SHOW_REVEAL;
      const mm = createFadeSlide(
        stage,
        [
          { ...heading, targets: group("heading") },
          { ...packages, targets: group("packages") },
          { ...details, targets: group("details") },
        ],
        params,
      );
      return () => mm.revert();
    },
    { dependencies: [SHOW_REVEAL], revertOnUpdate: true },
  );

  return (
    <section id="nosso-show" className={styles.show} aria-labelledby="nosso-show-title">
      <div ref={stageRef} className={`container-narrow ${styles.stage}`}>
        <header className={styles.intro}>
          <h2 id="nosso-show-title" className="type-title" data-reveal="heading">
            NOSSO SHOW
          </h2>
          <p className={`type-nav ${styles.eyebrow}`} data-reveal="heading">
            Orçamento de shows
          </p>
        </header>

        {/* Formatos: nome + duração à esquerda, preço à direita (estilo setlist). */}
        <ul className={styles.packages} aria-label="Formatos de show">
          {SHOW_PACKAGES.map((item) => (
            <li key={item.name} className={styles.package} data-reveal="packages">
              <div className={styles.packageInfo}>
                <h3 className={`type-caption ${styles.packageName}`}>{item.name}</h3>
                <p className={styles.duration}>{item.duration}</p>
              </div>
              <p className={styles.price}>{formatPrice(item.price)}</p>
            </li>
          ))}
        </ul>

        <div className={styles.details}>
          <div className={styles.detail} data-reveal="details">
            <h3 className={`type-nav ${styles.label}`}>Repertório</h3>
            <p className="type-body">{SHOW_REPERTOIRE.styles}</p>
            <p className={styles.note}>{SHOW_REPERTOIRE.note}</p>
          </div>
          <div className={styles.detail} data-reveal="details">
            <h3 className={`type-nav ${styles.label}`}>O show conta com</h3>
            <p className="type-body">{SHOW_INCLUDES}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
