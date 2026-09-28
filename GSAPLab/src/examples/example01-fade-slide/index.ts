import type { LabExample } from "../../lab/types";
import { Example01FadeSlide } from "./Example01FadeSlide";

export const example01: LabExample = {
  meta: {
    number: "01",
    title: "Fade + Slide",
    summary:
      "O scroll apenas dispara a animação: ao cruzar o start, o conteúdo sobe e aparece com sua própria duração e ease. É a base de quase toda animação de entrada.",
    categories: ["texto"],
    concepts: ["trigger", "start", "end", "gsap.from()", "duration", "ease", "toggleActions", "callbacks"],
    observe: [
      "Ligue os markers: a animação dispara quando “start” encosta em “scroller-start”.",
      "Role para baixo e depois para cima: veja no log qual ação do toggleActions roda em cada callback.",
      "Troque o toggleActions para “play none none none”: a animação passa a tocar só uma vez.",
      "Aumente o y e diminua a duration: a velocidade média muda (y ÷ duration).",
    ],
    sourcePath: "src/examples/example01-fade-slide/animation.ts",
  },
  Component: Example01FadeSlide,
};
