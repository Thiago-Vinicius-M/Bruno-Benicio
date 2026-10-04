"use client";

import type { MouseEvent } from "react";
import { useExperience } from "./experienceContext";
import { EXPERIENCES, type ExperienceId } from "./experiences";
import styles from "./Experience.module.css";

type MoreButtonProps = {
  /** subtela que o botão abre (experiences.tsx) */
  experience: ExperienceId;
  label?: string;
  /** "mobile" = só aparece em telas ≤ 767px */
  only?: "mobile";
  className?: string;
};

/**
 * "Ver mais" — abre uma subtela. É um link de verdade para o hash da subtela: sem JS, com
 * Ctrl/⌘ ou em nova aba ele continua funcionando (a página abre já na subtela).
 */
export function MoreButton({ experience, label = "Ver mais", only, className }: MoreButtonProps) {
  const { open } = useExperience();

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    // Nem todo navegador foca um link ao tocar: o foco volta para cá quando a subtela fecha.
    event.currentTarget.focus({ preventScroll: true });
    open(experience);
  };

  return (
    <a
      href={EXPERIENCES[experience].hash}
      className={className ? `${styles.more} ${className}` : styles.more}
      data-only={only}
      aria-haspopup="dialog"
      onClick={onClick}
    >
      {label}
      <span aria-hidden="true">→</span>
    </a>
  );
}
