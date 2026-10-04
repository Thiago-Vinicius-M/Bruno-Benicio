import type { ComponentType } from "react";
import { VideosExperience } from "@/components/Videos/VideosExperience";

/**
 * Subtelas da Home — conteúdo aprofundado que abre por cima da página (transição lateral)
 * em vez de deixar a Home longa demais.
 *
 * Nova subtela = uma entrada aqui + um <MoreButton experience="id" /> onde ela abre.
 *   hash    → endereço da subtela (link direto, botão voltar do navegador/celular)
 *   title   → título exibido no topo da subtela (h2)
 *   Content → conteúdo; marque com data-experience-item o que deve entrar em sequência
 */
export const EXPERIENCES = {
  videos: { hash: "#ver/videos", title: "VIDEOS", Content: VideosExperience },
} satisfies Record<string, { hash: string; title: string; Content: ComponentType }>;

export type ExperienceId = keyof typeof EXPERIENCES;

/** Subtela correspondente a um hash da URL (null = Home). */
export function experienceFromHash(hash: string): ExperienceId | null {
  const entry = Object.entries(EXPERIENCES).find(([, experience]) => experience.hash === hash);
  return entry ? (entry[0] as ExperienceId) : null;
}
