"use client";

import { createContext, useContext } from "react";
import type { ExperienceId } from "./experiences";

export type ExperienceApi = {
  /** subtela aberta (ou abrindo); null = Home */
  active: ExperienceId | null;
  open: (id: ExperienceId) => void;
  /** volta para a Home (mesmo efeito do "voltar" do navegador) */
  close: () => void;
};

export const ExperienceContext = createContext<ExperienceApi | null>(null);

export function useExperience() {
  const api = useContext(ExperienceContext);
  if (!api) throw new Error("useExperience precisa estar dentro de <ExperienceProvider>.");
  return api;
}
