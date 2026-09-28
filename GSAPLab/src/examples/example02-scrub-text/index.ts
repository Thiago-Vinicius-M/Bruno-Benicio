import type { LabExample } from "../../lab/types";
import { Example02ScrubText } from "./Example02ScrubText";

export const example02: LabExample = {
  meta: {
    number: "02",
    title: "Texto Scrubbed",
    summary:
      "Aqui o scroll não dispara: ele CONTROLA. Com scrub, a posição da barra de rolagem vira a posição do playhead da animação — role devagar, rápido, para trás, e o texto obedece.",
    categories: ["texto"],
    concepts: ["scrub: false", "scrub: true", "scrub: número", "playhead", "gsap.fromTo()", "ease: none", "onUpdate"],
    observe: [
      "Com scrub: true, as barras “scroll” e “playhead” do HUD andam exatamente juntas.",
      "Mude para scrub número (ex.: 2s) e role rápido: o playhead chega atrasado, com inércia.",
      "Com scrub: false, o scroll só dispara: o texto anda sozinho pela duration.",
      "Troque a ease para power2.out com scrub: o texto corre no começo e desacelera no fim do trecho.",
    ],
    sourcePath: "src/examples/example02-scrub-text/animation.ts",
  },
  Component: Example02ScrubText,
};
