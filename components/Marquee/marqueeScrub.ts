import type { ScrubTextParams } from "@/animations/scrubText";

/**
 * Texto scrubbed do Marquee — todos os valores ajustáveis do efeito ficam aqui.
 * A faixa desliza na horizontal enquanto o Marquee atravessa a tela, controlada pelo scroll.
 * Vale para os dois Marquees da página (cada um tem o próprio trigger).
 *
 * fromX / toX
 *   Posição horizontal da faixa (px) no início e no fim do trecho. A distância total é
 *   toX − fromX (hoje 400px). No mobile, metade.
 *   Aumentar a distância → a faixa corre mais rápido pelo mesmo scroll.
 *   Inverter os sinais (fromX 200, toX -200) → a faixa anda para a esquerda.
 *   Testar: ±100 sutil · ±200 padrão · ±320 forte. Acima de ~±450 a ponta da faixa pode
 *   aparecer na tela (ela começa ≈ 470px para fora, à esquerda, em 1920px).
 *
 * scrub
 *   true = grudado na barra de rolagem. Número = segundos para alcançar o scroll, com
 *   suavização: 0.5 leve · 1 macio · 2 flutuante.
 *
 * ease
 *   "none" = velocidade constante (recomendado com scrub). "power2.out" = anda muito no
 *   começo do trecho e pouco no final.
 *
 * start / end
 *   "top bottom" → "bottom top": o movimento acontece durante TODO o tempo em que o
 *   Marquee está visível. Trecho menor (ex.: end "center center") → mesma distância em
 *   menos scroll = parece mais rápido.
 *
 * markers
 *   true desenha as linhas de start/end para depuração. Manter false em produção.
 */
export const MARQUEE_SCRUB: ScrubTextParams = {
  scrub: true,
  fromX: -200,
  toX: 200,
  ease: "none",
  start: "top bottom",
  end: "bottom top",
  markers: false,
};
