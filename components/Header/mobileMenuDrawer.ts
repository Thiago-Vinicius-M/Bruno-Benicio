import type { DrawerParams } from "@/animations/drawer";

/**
 * Gaveta do menu do celular (animations/drawer.ts) — valores ajustáveis.
 *
 * duration / ease   overlay e painel ao abrir. 0.3 rápido · 0.45 padrão · 0.6 lento.
 * itemX             de quantos px à esquerda cada link entra.
 * itemStagger       intervalo entre os links. 0.04 fluido · 0.06 padrão · 0.1 sequencial.
 * itemsPosition     quando os links começam em relação ao painel ("-=0.25" = antes de ele
 *                   terminar de deslizar).
 * closeSpeed        fechamento N vezes mais rápido que a abertura.
 */
export const MOBILE_MENU_DRAWER: DrawerParams = {
  duration: 0.45,
  ease: "power3.out",
  itemX: 24,
  itemStagger: 0.06,
  itemsPosition: "-=0.25",
  closeSpeed: 1.6,
};
