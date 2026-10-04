"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useGSAP } from "@/animations/gsap";
import { createLoaderExit } from "@/animations/loaderExit";
import logo from "@/Imagens/BeB LOGO FUNDO PRETO_page-0001.png";
import { isPageReady, markPageReady, waitForPageResources } from "@/lib/pageReady";
import { LOADER } from "./loaderConfig";
import styles from "./Loader.module.css";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Tela de loading inicial. Vem no HTML do servidor (cobre a página desde o primeiro paint,
 * sem flash de conteúdo) e sai quando a página está pronta — então avisa o resto da página
 * (markPageReady) e é removida do DOM.
 *
 * Na volta à página por navegação client-side a página já está pronta: nada é renderizado.
 */
export function Loader() {
  const rootRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => !isPageReady());

  useGSAP(
    () => {
      if (!visible) return;
      let cancelled = false;
      let exit: ReturnType<typeof createLoaderExit> | undefined;

      const entranceLeft = Math.max(0, LOADER.entranceMs - performance.now());
      Promise.all([waitForPageResources(LOADER.maxWaitMs), wait(entranceLeft)]).then(() => {
        if (cancelled) return;
        exit = createLoaderExit({ root: rootRef.current!, mark: markRef.current! }, LOADER, {
          onReveal: markPageReady,
          onComplete: () => setVisible(false),
        });
      });

      return () => {
        cancelled = true;
        exit?.revert();
      };
    },
    { dependencies: [LOADER], revertOnUpdate: true },
  );

  if (!visible) return null;

  return (
    <div ref={rootRef} className={styles.loader} role="status" aria-label="Carregando">
      <div ref={markRef} className={styles.mark}>
        <Image src={logo} alt="" width={320} height={128} className={styles.logo} loading="eager" fetchPriority="high" />
      </div>
    </div>
  );
}
