import type { ParallaxLayer, ParallaxParams } from "@/animations/parallax";

/**
 * Parallax do Sobre Nós — todos os valores ajustáveis do efeito ficam aqui.
 * Vale para o carrossel (foto + descrição); a área do carrossel é o trigger.
 *
 * CAMADAS
 *   text  = frente → "up":   sobe mais rápido que a página
 *   photo = fundo  → "down": sobe um pouco mais devagar que a página
 *   A sensação de profundidade vem da DIFERENÇA de velocidade entre os dois.
 *
 * intensity (relativeTo "trigger")
 *   % da ALTURA DA LINHA percorrido enquanto ela atravessa a tela. Em 1920px a linha tem
 *   ≈ 384px (1% ≈ 4px): texto 14 → ~54px · foto 4 → ~15px.
 *   Medir pela linha (e não pelo próprio elemento) faz uma frase de uma linha andar tanto
 *   quanto uma de três. Testar no texto: 8 sutil · 14 médio · 22 forte. Acima de ~25 o
 *   texto começa a se afastar demais da foto.
 *
 * mobileFactor
 *   No celular foto e texto ficam empilhados e andam um em direção ao outro: com 0.2 a
 *   aproximação máxima (~14px) fica abaixo do espaço entre eles (20px). Acima de ~0.3
 *   o texto pode encostar na foto.
 *
 * scrub
 *   true = preso à barra de rolagem. Número = segundos para alcançar o scroll (suaviza).
 *
 * start / end
 *   "top bottom" → "bottom top": o movimento acontece durante todo o tempo em que a linha
 *   está visível. No início a posição é exatamente a do layout.
 *
 * markers
 *   true desenha as linhas de start/end para depuração. Manter false em produção.
 */
export const ABOUT_PARALLAX = {
  text: { intensity: 14, direction: "up", relativeTo: "trigger" },
  photo: { intensity: 4, direction: "down", relativeTo: "trigger" },
  mobileFactor: 0.2,
  scrub: 0.6,
  start: "top bottom",
  end: "bottom top",
  markers: false,
} satisfies ParallaxParams & Record<"text" | "photo", ParallaxLayer>;
