import type { VideoPlacement } from "@/lib/videos/types";

/** Nomes da classificação editorial no painel (lista e formulário). */
export const PLACEMENT_LABEL: Record<VideoPlacement, string> = {
  main: "Principal",
  secondary: "Secundário",
  gallery: "Só no “Ver mais”",
};

export const PLACEMENTS = Object.keys(PLACEMENT_LABEL) as VideoPlacement[];
