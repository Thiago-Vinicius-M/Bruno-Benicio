"use client";

import { Fragment, useRef } from "react";
import Image from "next/image";
import { useGSAP } from "@/animations/gsap";
import { createParallax } from "@/animations/parallax";
import { createTextStagger } from "@/animations/textStagger";
import heroPhoto from "@/Imagens/OsDoisHero.png";
import heroLogo from "@/Imagens/BeB LOGO FUNDO PRETO_page-0001.png";
import { HERO_PARALLAX } from "./heroParallax";
import { HERO_TITLE_STAGGER } from "./heroTitleStagger";
import styles from "./Hero.module.css";

const TITLE = "Isso é Bruno e Benício! Vem com nois";

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // A seção é o trigger (não é animada); logo e foto são as camadas.
  // HERO_PARALLAX como dependência: ao editar o config no `next dev`, o efeito é revertido e
  // recriado com os novos valores. Em produção o objeto nunca muda, então roda uma única vez.
  useGSAP(
    () => {
      const mm = createParallax(
        sectionRef.current!,
        [
          { element: logoRef.current!, ...HERO_PARALLAX.heroLogo },
          { element: photoRef.current!, ...HERO_PARALLAX.heroPhoto },
        ],
        HERO_PARALLAX,
      );
      return () => mm.revert();
    },
    { dependencies: [HERO_PARALLAX], revertOnUpdate: true },
  );

  // O título é o trigger (não é animado); as palavras/letras dentro das máscaras são os alvos.
  useGSAP(
    () => {
      const mm = createTextStagger(titleRef.current!, HERO_TITLE_STAGGER);
      return () => mm.revert();
    },
    { dependencies: [HERO_TITLE_STAGGER], revertOnUpdate: true },
  );

  return (
    <section id="home" ref={sectionRef} className={styles.hero}>
      <Image
        ref={logoRef}
        src={heroLogo}
        width={1040}
        height={416}
        alt="Logo da Home"
        className={styles.backdrop}
        loading="eager"
      />
      <Image
        ref={photoRef}
        src={heroPhoto}
        width={800}
        height={640}
        alt="Bruno cantando ao microfone e Benício tocando violão"
        className={styles.photo}
        loading="eager"
        fetchPriority="high"
      />
      {/* Leitores de tela leem o aria-label; os spans da animação ficam ocultos para eles. */}
      <h1 ref={titleRef} className={`container type-display ${styles.title}`} aria-label={TITLE}>
        {TITLE.split(" ").map((word, i) => (
          <Fragment key={i}>
            {i > 0 && " "}
            <span className={styles.mask} aria-hidden="true">
              {HERO_TITLE_STAGGER.split === "words" ? (
                <span className={styles.word} data-stagger-target>
                  {word}
                </span>
              ) : (
                <span className={styles.word}>
                  {[...word].map((char, j) => (
                    <span key={j} className={styles.char} data-stagger-target>
                      {char}
                    </span>
                  ))}
                </span>
              )}
            </span>
          </Fragment>
        ))}
      </h1>
    </section>
  );
}
