import type { StaticImageData } from "next/image";
import fotoDupla from "@/Imagens/OsDoisFrenteP&B.jpg";
import fotoBenicio from "@/Imagens/BenicioCantandoP&B.jpg";
import fotoBruno from "@/Imagens/BrunoSorriP&B.jpg";

/**
 * Slides do SOBRE NÓS (carrossel em About.tsx), na ordem em que aparecem.
 * Para trocar um texto ou foto, altere só aqui.
 */
export type AboutSlide = {
  id: "dupla" | "bruno" | "benicio";
  /** nome exibido acima da descrição e no rótulo das bolinhas */
  name: string;
  text: string;
  image: StaticImageData;
  alt: string;
};

export const ABOUT_SLIDES: AboutSlide[] = [
  {
    id: "dupla",
    name: "Bruno e Benício",
    text: "Nossa paixão pela música nos uniu com um propósito: levar alegria, música e bons momentos por onde passamos. Já são mais de 5 anos de profissionalismo, construindo nossa história, vivendo experiências e colecionando momentos especiais por meio da música.",
    image: fotoDupla,
    alt: "Bruno e Benício",
  },
  {
    id: "bruno",
    name: "Bruno",
    text: "Bruno (Descrição)",
    image: fotoBruno,
    alt: "Bruno sorrindo",
  },
  {
    id: "benicio",
    name: "Benício",
    text: "Benício (Descrição)",
    image: fotoBenicio,
    alt: "Benício cantando",
  },
];
