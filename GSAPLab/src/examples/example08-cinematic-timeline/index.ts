import type { LabExample } from "../../lab/types";
import { Example08CinematicTimeline } from "./Example08CinematicTimeline";

export const example08: LabExample = {
  meta: {
    number: "08",
    title: "Timeline Cinematic",
    summary:
      "Seis passos (texto entra, imagem aparece, aumenta, texto sobe, legenda surge, imagem reduz) numa única gsap.timeline() controlada por UM ScrollTrigger com pin e scrub. O position parameter decide quando cada passo começa.",
    categories: ["texto", "imagem"],
    concepts: ["gsap.timeline()", ".to() / .from() / .fromTo()", "position parameter", "defaults", "duração relativa", "sobreposição", "getChildren()"],
    observe: [
      "A régua mostra onde cada tween começa e quanto dura; a agulha é tl.time().",
      "Mude o passo 4 de “<” para “>”: o texto espera a imagem terminar de crescer.",
      "Passo 6 com “+=1” cria uma pausa (1s de timeline = trecho de scroll sem nada mudar).",
      "Aumente o end: a mesma timeline fica mais “lenta” por pixel rolado (duração relativa).",
    ],
    sourcePath: "src/examples/example08-cinematic-timeline/animation.ts",
  },
  Component: Example08CinematicTimeline,
};
