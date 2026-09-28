import type { LabExample } from "../../lab/types";
import { Example07VideoPin } from "./Example07VideoPin";

export const example07: LabExample = {
  meta: {
    number: "07",
    title: "Vídeo com Pin",
    summary:
      "A seção fica presa na tela (pin) enquanto você continua rolando; esse trecho de scroll move uma timeline que expande o vídeo e troca as legendas. O pin-spacer reserva o espaço do pin no documento.",
    categories: ["vídeo", "texto"],
    concepts: ["pin: true", "pinSpacing", "pin-spacer", "start: top top", "end: +=", "scrub", "timeline", "onToggle"],
    observe: [
      "Ligue os markers: o pin vai de “start” até “end”; a distância aparece no HUD (end − start).",
      "Abra o DevTools: a seção fica dentro de um div.pin-spacer com padding-bottom.",
      "Desligue pinSpacing e role: o bloco “depois do pin” sobe por cima do vídeo.",
      "O vídeo só toca enquanto o pin está ativo (callback onToggle).",
    ],
    sourcePath: "src/examples/example07-video-pin/animation.ts",
  },
  Component: Example07VideoPin,
};
