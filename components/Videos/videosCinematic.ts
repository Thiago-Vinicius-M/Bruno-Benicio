import type { CinematicTimelineParams } from "@/animations/cinematicTimeline";

/**
 * Timeline cinematic da seção de Vídeos — todos os valores ajustáveis do efeito ficam aqui.
 *
 * SEQUÊNCIA (a seção fica presa na tela enquanto ela acontece)
 *   1 · a frase "Agora queremos compartilhar..." surge no centro da tela
 *   2 · a galeria de vídeos aparece ATRÁS da frase (o recorte se abre)
 *   3 · os vídeos crescem até o tamanho final
 *   4 · a frase sobe para o lugar dela, acima dos vídeos
 *   5 · o título "VIDEOS" aparece
 *   Depois da pausa final a seção é solta e o scroll segue pelos vídeos.
 *
 * pos2 … pos5 (position parameter — quando cada passo começa)
 *   ">"  no fim do passo anterior · "<" junto com o anterior · "+=0.5" pausa de 0.5
 *   · "-=0.5" sobrepõe 0.5 · "<0.5" 0.5 depois do INÍCIO do anterior.
 *   pos4 "<" → a frase sobe enquanto os vídeos crescem. Trocar para ">" → a frase espera
 *   os vídeos terminarem de crescer.
 *
 * hold
 *   Pausa no fim (em "segundos" da timeline), com tudo parado no lugar, antes de soltar
 *   a seção. 0 = solta assim que o título aparece.
 *
 * textScale
 *   Tamanho da frase enquanto está no centro (1 = tamanho normal). No celular usa metade
 *   do aumento (1.3 → 1.15).
 *
 * mediaScale
 *   Tamanho da galeria quando aparece (0.7 = 70%). Menor → mais da galeria cabe na tela.
 *
 * mediaDim
 *   Brilho dos vídeos enquanto a frase está na frente deles (1 = normal · 0.4 = bem
 *   escuro). Voltam ao normal quando a frase sobe. Menor → frase mais legível.
 *
 * ease
 *   Curva de todos os passos. "power2.inOut" = começa e termina suave.
 *
 * screens
 *   Quanto scroll a sequência consome, em alturas de tela. Maior → mais lenta por pixel
 *   rolado. Testar: 1.5 rápida · 2.5 padrão · 4 lenta.
 *
 * scrub
 *   true = preso à barra de rolagem. Número = segundos para alcançar o scroll (suavização):
 *   0.5 leve · 1 macio · 2 flutuante.
 *
 * markers
 *   true desenha as linhas de start/end para depuração. Manter false em produção.
 */
export const VIDEOS_CINEMATIC: CinematicTimelineParams = {
  pos2: ">",
  pos3: ">",
  pos4: "<",
  pos5: "-=0.5",
  hold: 0.5,
  textScale: 1.3,
  mediaScale: 0.7,
  mediaDim: 0.4,
  ease: "power2.inOut",
  screens: 2.5,
  scrub: 1,
  markers: false,
};
