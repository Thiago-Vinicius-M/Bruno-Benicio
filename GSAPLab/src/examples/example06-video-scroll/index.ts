import type { LabExample } from "../../lab/types";
import { Example06VideoScroll } from "./Example06VideoScroll";

export const example06: LabExample = {
  meta: {
    number: "06",
    title: "Vídeo controlado pelo Scroll",
    summary:
      "O progresso do ScrollTrigger (0 → 1) é convertido em currentTime (0 → duration). Para isso ser confiável, esperamos o metadata do vídeo antes de criar qualquer coisa.",
    categories: ["vídeo"],
    concepts: ["loadedmetadata", "readyState", "duration", "currentTime", "progress", "ScrollTrigger.create()", "contextSafe"],
    observe: [
      "O status mostra o momento em que o metadata chega — só então a animação é criada.",
      "Role para trás: a flor “fecha”. O vídeo foi codificado com todo frame como keyframe.",
      "Compare os métodos: tween (com scrub 1 = suave) × onUpdate (seek direto, sem suavização).",
      "Aumente a altura do trilho: o mesmo vídeo passa a ocupar mais scroll.",
    ],
    sourcePath: "src/examples/example06-video-scroll/animation.ts",
  },
  Component: Example06VideoScroll,
};
