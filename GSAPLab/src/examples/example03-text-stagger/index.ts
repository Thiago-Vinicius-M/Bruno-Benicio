import type { LabExample } from "../../lab/types";
import { Example03TextStagger } from "./Example03TextStagger";

export const example03: LabExample = {
  meta: {
    number: "03",
    title: "Texto com Stagger",
    summary:
      "Um único tween anima vários alvos, cada um começando um pouco depois do anterior. Você controla o intervalo (each), o tempo total (amount) e de onde a “onda” parte (from).",
    categories: ["texto"],
    concepts: ["gsap.utils.toArray()", "stagger", "each", "amount", "from", "yPercent", "rotation", "máscara"],
    observe: [
      "Com stagger 0.1 as palavras parecem um movimento só; com 0.3 viram uma sequência.",
      "Troque para letras e compare each (tempo cresce com o nº de alvos) vs amount (tempo total fixo).",
      "Com letras, experimente from: center, edges e random.",
      "tween.duration() já inclui o escalonamento — compare com a conta manual.",
    ],
    sourcePath: "src/examples/example03-text-stagger/animation.ts",
  },
  Component: Example03TextStagger,
};
