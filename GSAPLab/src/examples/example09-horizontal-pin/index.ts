import type { LabExample } from "../../lab/types";
import { Example09HorizontalPin } from "./Example09HorizontalPin";

export const example09: LabExample = {
  meta: {
    number: "09",
    title: "Pin + Movimento Horizontal",
    summary:
      "Uma seção pinada converte scroll vertical em movimento horizontal. A distância não é “chutada”: ela é medida (scrollWidth − clientWidth) e recalculada a cada refresh, o que torna a técnica responsiva.",
    categories: ["imagem", "texto"],
    concepts: ["pin", "scrub", "scrollWidth", "clientWidth", "end dinâmico", "invalidateOnRefresh", "xPercent", "timeline"],
    observe: [
      "No HUD: distância = scrollWidth − clientWidth, e end − start = distância × speed.",
      "Redimensione a janela: os números mudam e o último card continua encostando na borda.",
      "Troque para o modo xPercent: cada painel anda conforme a própria largura e o último para no lugar errado.",
      "speed 2: o mesmo movimento pede o dobro de scroll.",
    ],
    sourcePath: "src/examples/example09-horizontal-pin/animation.ts",
  },
  Component: Example09HorizontalPin,
};
