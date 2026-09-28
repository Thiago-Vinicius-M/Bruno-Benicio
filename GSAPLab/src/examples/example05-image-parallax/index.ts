import type { LabExample } from "../../lab/types";
import { Example05ImageParallax } from "./Example05ImageParallax";

export const example05: LabExample = {
  meta: {
    number: "05",
    title: "Imagem Parallax",
    summary:
      "A foto se desloca dentro de uma moldura com overflow: hidden, numa velocidade diferente do resto da página. A diferença de velocidade cria a ilusão de profundidade.",
    categories: ["imagem"],
    concepts: ["parallax", "yPercent", "overflow: hidden", "scrub: true", "ease: none", "gsap.set()", "matchMedia"],
    observe: [
      "Compare a velocidade da foto com a do texto “conteúdo normal” acima e abaixo dela.",
      "Teste intensidade 20, 50 e 100 e veja no diagrama a altura que a imagem precisa ter.",
      "Desligue “compensar altura” e role até o fim da moldura: aparece o buraco.",
      "Troque a direção para down: a foto passa a parecer mais distante (mais lenta).",
    ],
    sourcePath: "src/examples/example05-image-parallax/animation.ts",
  },
  Component: Example05ImageParallax,
};
