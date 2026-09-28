import type { LabExample } from "../../lab/types";
import { Example04ImageReveal } from "./Example04ImageReveal";

export const example04: LabExample = {
  meta: {
    number: "04",
    title: "Imagem Reveal / Clip",
    summary:
      "A imagem começa recortada e o recorte se abre conforme você rola, enquanto a foto interna perde escala. É a combinação de propriedades CSS (clip-path, overflow, object-fit) com a interpolação do GSAP.",
    categories: ["imagem"],
    concepts: ["clipPath", "scale", "transformOrigin", "timeline", "scrub", "start", "end", "overflow: hidden"],
    observe: [
      "O HUD mostra a string de clip-path sendo interpolada número a número.",
      "Troque transformOrigin para “top center”: a escala passa a “ancorar” no topo.",
      "Aproxime start e end (ex.: “top 90%” → “top 60%”): o reveal acontece em menos scroll.",
      "Use scrub 1 ou 2 para um reveal com inércia.",
    ],
    sourcePath: "src/examples/example04-image-reveal/animation.ts",
  },
  Component: Example04ImageReveal,
};
