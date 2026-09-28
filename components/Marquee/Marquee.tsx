"use client";

import { Fragment, useRef } from "react";
import Image from "next/image";
import { useGSAP } from "@/animations/gsap";
import beerIcon from "@/Imagens/beer-mug-svgrepo-com.svg";
import { createScrubText } from "@/animations/scrubText";
import { MARQUEE_SCRUB } from "./marqueeScrub";
import styles from "./Marquee.module.css";

/**
 * Quantidade de pares texto + ícone na faixa. A faixa precisa ser mais larga que a tela
 * mesmo com o deslocamento do scrub (±200px); com o texto em 96px, 5 pares garantem isso
 * até ~2700px de largura de tela.
 */
const GROUP_COUNT = 5;

export function Marquee() {
  const marqueeRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // O Marquee é o trigger (não é animado); a faixa desliza em x controlada pelo scroll.
  useGSAP(
    () => {
      const mm = createScrubText(marqueeRef.current!, trackRef.current!, MARQUEE_SCRUB);
      return () => mm.revert();
    },
    { dependencies: [MARQUEE_SCRUB], revertOnUpdate: true },
  );

  return (
    <div ref={marqueeRef} className={styles.marquee} aria-hidden="true">
      <div ref={trackRef} className={styles.track}>
        {Array.from({ length: GROUP_COUNT }, (_, index) => (
          <Fragment key={index}>
            <span className={styles.text}>BRUNO &amp; BENÍCIO</span>
            <Image src={beerIcon} alt="" className={styles.icon} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
