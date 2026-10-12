"use client";

import { Fragment, useRef } from "react";
import { createFadeSlide } from "@/animations/fadeSlide";
import { useGSAP } from "@/animations/gsap";
import { createTextStagger } from "@/animations/textStagger";
import { MODELS_TEXT_REVEAL, MODELS_TITLE_STAGGER } from "./modelsStagger";
import styles from "./Models.module.css";

const TITLE = "EAI, GOSTOU?";

export function Models() {
  const titleRef = useRef<HTMLParagraphElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  // A frase é o trigger (não é animada); os alvos são as palavras/letras com data-stagger-target.
  useGSAP(
    () => {
      const mm = createTextStagger(titleRef.current!, MODELS_TITLE_STAGGER);
      return () => mm.revert();
    },
    { dependencies: [MODELS_TITLE_STAGGER], revertOnUpdate: true },
  );

  // Parágrafo: entra logo depois da frase (ele mesmo é o trigger e o alvo).
  useGSAP(
    () => {
      const text = textRef.current!;
      const { text: step, ...params } = MODELS_TEXT_REVEAL;
      const mm = createFadeSlide(text, [{ ...step, targets: [text] }], params);
      return () => mm.revert();
    },
    { dependencies: [MODELS_TEXT_REVEAL], revertOnUpdate: true },
  );

  return (
    <section className={styles.models}>
      <div className="container">
        {/* Leitores de tela leem o aria-label; os spans da animação ficam ocultos para eles. */}
        <p ref={titleRef} className="type-editorial" aria-label={TITLE}>
          {TITLE.split(" ").map((word, i) => (
            <Fragment key={i}>
              {i > 0 && " "}
              <span className={styles.mask} aria-hidden="true">
                {MODELS_TITLE_STAGGER.split === "words" ? (
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
        </p>
        <p ref={textRef} className="type-body">
          Agora que você já conhece um pouco dos Pretin mais amados do Brasil, chegou a hora de
          escolher o formato que mais combina com a sua festa.
        </p>
      </div>
    </section>
  );
}
