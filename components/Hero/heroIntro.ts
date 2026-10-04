import type { FadeSlideStepParams } from "@/animations/fadeSlide";
import type { IntroRevealParams } from "@/animations/introReveal";

/**
 * Entrada do Hero ao abrir a página (depois da tela de loading) — todos os valores
 * ajustáveis do efeito ficam aqui. Sequência:
 *   1 · heroLogo  — o logo de fundo surge desfocado e levemente ampliado, assentando
 *   2 · heroPhoto — a foto da dupla sobe e é revelada de baixo para cima (recorte)
 *   3 · título    — no ponto titlePosition, o stagger do título (heroTitleStagger.ts) assume
 *
 * delay
 *   Segundos entre o loading começar a sair e a entrada começar. Pequeno = a entrada
 *   acontece junto com a saída do loading (transição contínua).
 *
 * duration / ease
 *   Padrão de cada passo. "power3.out" começa rápido e desacelera suave.
 *
 * y / scale / blur (por passo)
 *   Estado inicial: px abaixo da posição final · escala (1 = sem escala) · desfoque em px.
 *
 * clip (por passo)
 *   Recorte inicial "topo direita base esquerda" (inset) que abre até 0. "100% 0% 0% 0%"
 *   = começa totalmente recortado e revela de baixo para cima · "30% 0% 0% 0%" = mais sutil.
 *
 * position (por passo)
 *   Quando o passo começa em relação ao anterior: "-=0.8" sobrepõe 0.8s · ">" no fim.
 *
 * intensity / mobileFactor
 *   Multiplicam y, blur e escala (0 = só fade). mobileFactor vale em telas ≤ 767px.
 *
 * titlePosition
 *   Quando o título entra, em relação ao passo anterior. Se o título não estiver na tela
 *   (ex.: notebook baixo), o stagger dele continua esperando o scroll, como antes.
 */
export const HERO_INTRO = {
  delay: 0.15,
  duration: 1.2,
  ease: "power3.out",
  intensity: 1,
  mobileFactor: 0.6,
  heroLogo: { y: 24, scale: 1.06, blur: 8 },
  heroPhoto: { y: 48, clip: "100% 0% 0% 0%", duration: 1.1, position: "-=0.85" },
  titlePosition: "-=0.55",
} satisfies IntroRevealParams & Record<"heroLogo" | "heroPhoto", FadeSlideStepParams> & { titlePosition: string };
