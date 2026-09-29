import type { FadeSlideParams, FadeSlideStepParams } from "@/animations/fadeSlide";

export type MusicRevealConfig = FadeSlideParams & {
  heading: FadeSlideStepParams;
  decor: FadeSlideStepParams;
  player: FadeSlideStepParams;
  tracks: FadeSlideStepParams;
};

/**
 * Entrada da seção MÚSICAS — todos os valores ajustáveis do efeito ficam aqui.
 *
 * SEQUÊNCIA (toca quando a seção entra na tela)
 *   heading → título "MÚSICAS" e a frase logo abaixo, um depois do outro
 *   decor   → luz atrás do player se acende, crescendo devagar
 *   player  → moldura do player sobe e cresce levemente
 *   tracks  → músicas da lista e o botão do Spotify, em sequência
 *
 * INTENSIDADE (o controle mais rápido)
 *   intensity    → multiplica y, blur e escala de todos os passos.
 *                  0 = só fade · 0.5 = discreto · 1 = padrão · 1.5 = marcado.
 *   mobileFactor → multiplicador extra no celular (≤ 767px). 0.6 = 60% do movimento.
 *
 * POR PASSO
 *   y         → quantos px o elemento sobe ao aparecer
 *   scale     → escala inicial (0.96 = começa 4% menor; 1 = sem escala)
 *   blur      → desfoque inicial em px (0 = sem). Evite no player (iframe).
 *   stagger   → intervalo entre os itens do grupo, em segundos
 *   duration  → duração de cada item (sem valor = `duration` geral)
 *   position  → quando o passo começa: ">" depois do anterior · "-=0.5" sobrepõe 0.5s
 *               · "<" junto com o anterior · "<0.2" 0.2s depois do INÍCIO do anterior
 *
 * GERAL
 *   duration      → duração padrão de cada passo, em segundos (0.6 rápido · 0.9 padrão · 1.2 lento)
 *   ease          → curva. "power3.out" = começa rápido e assenta suave.
 *                   Testar: "power2.out" (mais macio) · "expo.out" (mais seco)
 *   start         → quando dispara. "top 70%" = topo da seção a 70% da altura da tela.
 *   toggleActions → "play none none none" toca uma vez · "play none none reverse" desfaz
 *                   ao rolar de volta para cima.
 *   markers       → true desenha a linha de start para depuração. Manter false em produção.
 */
export const MUSIC_REVEAL: MusicRevealConfig = {
  duration: 0.9,
  ease: "power3.out",
  intensity: 1,
  mobileFactor: 0.6,
  start: "top 70%",
  toggleActions: "play none none none",
  markers: false,

  heading: { y: 28, blur: 6, stagger: 0.12 },
  decor: { y: 0, scale: 0.8, duration: 1.8, position: "-=0.5" },
  player: { y: 40, scale: 0.97, position: "<0.1" },
  tracks: { y: 18, stagger: 0.08, duration: 0.7, position: "-=0.55" },
};
