import type { LabExample } from "../../lab/types";
import { Example10SnapStory } from "./Example10SnapStory";

export const example10: LabExample = {
  meta: {
    number: "10",
    title: "Snap + Scroll Story",
    summary:
      "Quatro momentos (texto, imagem, vídeo, mensagem final) numa seção pinada. A timeline marca cada momento com um label, e o snap encaixa o progresso nesses labels quando você para de rolar.",
    categories: ["vídeo", "imagem", "texto"],
    concepts: ["snap", 'snapTo: "labels"', "addLabel()", "currentLabel()", "labelToScroll()", "directional", "pin", "scrub"],
    observe: [
      "Role até o meio de uma transição e solte: o snap completa até o próximo momento.",
      "Troque snapTo para 0.1: o encaixe passa a parar no meio das transições.",
      "Clique nos pontos: labelToScroll() converte o label em posição de scroll.",
      "O vídeo só toca no momento 03 (onUpdate + currentLabel()).",
    ],
    sourcePath: "src/examples/example10-snap-story/animation.ts",
  },
  Component: Example10SnapStory,
};
