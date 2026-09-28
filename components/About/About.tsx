"use client";

import { useRef } from "react";
import Image, { type StaticImageData } from "next/image";
import { useGSAP } from "@/animations/gsap";
import { createParallax } from "@/animations/parallax";
import { ABOUT_PARALLAX } from "./aboutParallax";
import styles from "./About.module.css";
import fotoDupla from "@/Imagens/OsDoisFrenteP&B.jpg";
import fotoBenicio from "@/Imagens/BenicioCantandoP&B.jpg";
import fotoBruno from "@/Imagens/BrunoSorriP&B.jpg";

type AboutRow = {
  text: string;
  image: StaticImageData;
  alt: string;
  /** Lado em que a foto fica. */
  media: "start" | "end";
  /** Alinhamento vertical do texto em relação à foto. */
  align: "center" | "end";
};

const ROWS: AboutRow[] = [
  {
    text: "Nossa paixão pela música nos uniu com um propósito: levar alegria, música e bons momentos por onde passamos.",
    image: fotoDupla,
    alt: "Bruno e Benício",
    media: "start",
    align: "center",
  },
  {
    text: "Benício (Descrição)",
    image: fotoBenicio,
    alt: "Benício cantando",
    media: "end",
    align: "end",
  },
  {
    text: "Bruno (Descrição)",
    image: fotoBruno,
    alt: "Bruno sorrindo",
    media: "start",
    align: "end",
  },
];

export function About() {
  const rowsRef = useRef<(HTMLDivElement | null)[]>([]);
  const photosRef = useRef<(HTMLImageElement | null)[]>([]);
  const textsRef = useRef<(HTMLParagraphElement | null)[]>([]);

  // Cada linha é o trigger do próprio parallax (não é animada); foto e texto são as camadas.
  useGSAP(
    () => {
      const mms = ROWS.map((_, i) =>
        createParallax(
          rowsRef.current[i]!,
          [
            { element: textsRef.current[i]!, ...ABOUT_PARALLAX.text },
            { element: photosRef.current[i]!, ...ABOUT_PARALLAX.photo },
          ],
          ABOUT_PARALLAX,
        ),
      );
      return () => mms.forEach((mm) => mm.revert());
    },
    { dependencies: [ABOUT_PARALLAX], revertOnUpdate: true },
  );

  return (
    <section id="sobre-nos" className={styles.about}>
      <h2 className="container type-title">SOBRE NÓS</h2>
      <div className={`container-wide ${styles.rows}`}>
        {ROWS.map((row, i) => (
          <div
            key={row.text}
            ref={(el) => {
              rowsRef.current[i] = el;
            }}
            className={styles.row}
            data-media={row.media}
            data-align={row.align}
          >
            <Image
              ref={(el) => {
                photosRef.current[i] = el;
              }}
              src={row.image}
              width={384}
              height={384}
              alt={row.alt}
              className={styles.media}
            />
            <p
              ref={(el) => {
                textsRef.current[i] = el;
              }}
              className={`type-body ${styles.text}`}
            >
              {row.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
