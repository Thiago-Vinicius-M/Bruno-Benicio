import type { TextStaggerParams } from "@/animations/textStagger";

/**
 * Stagger do título do Hero — todos os valores ajustáveis do efeito ficam aqui.
 * Cada palavra (ou letra) sobe de dentro da própria linha, uma depois da outra.
 *
 * split
 *   "words" → 8 alvos (palavras) · "chars" → 29 alvos (letras e pontuação).
 *   Com letras, from "center" / "edges" / "random" ficam bem mais visíveis.
 *
 * staggerMode + staggerValue
 *   "each"   → intervalo FIXO entre o início de cada alvo. 8 palavras × 0.1 → a última
 *              começa em 0.7s; 29 letras × 0.1 → 2.8s (demora!).
 *   "amount" → tempo TOTAL do escalonamento, dividido entre os alvos. Fica igual com
 *              palavras ou letras (ex.: amount 0.6 com letras ≈ 0.02s entre cada).
 *   Valor menor → as palavras se sobrepõem, parece UM movimento fluido.
 *   Valor maior → parece uma SEQUÊNCIA, mais lenta e enfática.
 *   Testar (each): 0.05 fluido · 0.1 padrão · 0.2 enfático · 0.3 bem sequencial.
 *
 * from
 *   De onde a "onda" parte: "start" | "end" | "center" | "edges" | "random".
 *
 * yPercent
 *   Posição inicial de cada alvo, em % da altura dele. 110 = totalmente escondido abaixo
 *   da máscara. Menor (ex.: 50) → o texto já começa meio visível e sobe menos.
 *
 * rotation
 *   Inclinação inicial em graus (gira a partir do canto inferior esquerdo). 0 = sobe reto
 *   · 8 = leve · 20 = dramático. No celular usa a metade.
 *
 * duration
 *   Duração do movimento de CADA alvo, em segundos. 0.5 rápido · 0.8 padrão · 1.2 lento.
 *   Tempo total ≈ duration + atraso do último alvo.
 *
 * ease
 *   Curva de aceleração. "power3.out" = começa rápido e desacelera suave.
 *   Testar: "power2.out" (mais suave) · "expo.out" (mais seco) · "back.out(1.7)" (passa
 *   um pouco do ponto e volta).
 *
 * start
 *   Quando dispara ("<ponto do título> <ponto da tela>"). "top 75%" = quando o topo do
 *   título chega a 75% da altura da tela. "top bottom" → assim que aparece · "top center"
 *   → mais tarde. Se o título já estiver visível ao abrir a página, toca na hora.
 *
 * toggleActions
 *   "onEnter onLeave onEnterBack onLeaveBack". "play none none reverse" = toca ao entrar e
 *   desfaz ao voltar para cima do start. "play none none none" = toca uma única vez.
 *
 * markers
 *   true desenha a linha de start para depuração. Manter false em produção.
 */
export const HERO_TITLE_STAGGER: TextStaggerParams = {
  split: "words",
  staggerMode: "each",
  staggerValue: 0.1,
  from: "start",
  yPercent: 110,
  rotation: 8,
  duration: 0.8,
  ease: "power3.out",
  start: "top 75%",
  toggleActions: "play none none reverse",
  markers: false,
};
