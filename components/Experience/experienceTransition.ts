import type { ScreenTransitionParams } from "@/animations/screenTransition";

/**
 * Transição Home ↔ subtela — todos os valores ajustáveis do efeito ficam aqui.
 *
 * duration / ease
 *   Saída da Home e entrada da subtela. 0.6 rápido · 0.8 padrão · 1.1 cinematográfico.
 *   "power3.inOut" começa e termina suave (as duas telas parecem uma só "câmera").
 *
 * homeShift
 *   Quanto a Home anda para a esquerda enquanto some (% da largura). 100 = sai inteira
 *   (parece um carrossel) · 30 = só "recua", com mais profundidade.
 *
 * screenPosition
 *   Quando a subtela começa a entrar em relação à saída da Home. "<0.15" = 0.15s depois
 *   da Home começar a sair (as duas se movem juntas) · ">" = só depois de a Home sumir.
 *
 * itemX / itemStagger / itemsPosition
 *   Os itens da subtela (botão voltar, título, conteúdo) entram da direita em sequência:
 *   itemX px de deslocamento, itemStagger s entre cada um, começando em itemsPosition
 *   ("-=0.35" = antes de a subtela terminar de entrar).
 *
 * closeSpeed
 *   A volta é a mesma animação ao contrário, closeSpeed vezes mais rápida.
 *
 * reducedDuration
 *   Com "reduzir movimento" ligado no aparelho: só um fade entre as telas, desta duração.
 */
export const EXPERIENCE_TRANSITION: ScreenTransitionParams = {
  duration: 0.8,
  ease: "power3.inOut",
  homeShift: 30,
  screenPosition: "<0.15",
  itemX: 40,
  itemStagger: 0.07,
  itemsPosition: "-=0.35",
  closeSpeed: 1.3,
  reducedDuration: 0.25,
};

