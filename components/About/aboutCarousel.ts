import type { PanelSwapParams } from "@/animations/panelSwap";

/**
 * Carrossel do SOBRE NÓS (About.tsx) — valores ajustáveis da troca de slides.
 * A descrição sai para um lado e a próxima entra pelo outro, no sentido do arraste;
 * a foto troca junto, com um movimento mais discreto.
 *
 * duration / ease   cada slide. 0.35 rápido · 0.55 padrão · 0.8 lento.
 * shift             deslocamento lateral (% da largura). Texto: 10 sutil · 25 padrão · 40 forte.
 * enterPosition     quando o próximo entra: "<0.12" = quase junto com a saída do atual
 *                   · ">" = só depois de o atual sair.
 */
export const ABOUT_TEXT_SWAP: PanelSwapParams = {
  duration: 0.55,
  ease: "power3.out",
  shift: 25,
  enterPosition: "<0.12",
};

export const ABOUT_PHOTO_SWAP: PanelSwapParams = {
  duration: 0.6,
  ease: "power2.out",
  shift: 6,
  enterPosition: "<0.05",
};

/**
 * Arraste: distância horizontal mínima (px) para trocar de slide. Menor = mais sensível.
 * O gesto também precisa ser mais horizontal que vertical, para não atrapalhar a rolagem.
 */
export const ABOUT_SWIPE_MIN = 40;
