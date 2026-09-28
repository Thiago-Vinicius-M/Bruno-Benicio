"use client";

import { useEffect, useRef } from "react";
import { useGSAP } from "@/animations/gsap";
import { createCinematicTimeline, scrollToCinematicEnd } from "@/animations/cinematicTimeline";
import thumbAmigo from "@/Imagens/thumbAmigo.jpg";
import thumbFoiDeus from "@/Imagens/thumbFoiDeus.jpg";
import thumbManeiraErrada from "@/Imagens/thumbManeiraErrada.jpg";
import thumbSoProMeuPrazer from "@/Imagens/thumbSoProMeuPrazer (1).jpg";
import { VideoCard, type Video } from "./VideoCard";
import { VIDEOS_CINEMATIC } from "./videosCinematic";
import styles from "./Videos.module.css";

// Para usar o vídeo no lugar da thumbnail, informe `src` (ex.: "/videos/foi-deus.mp4").
const VIDEOS: Video[] = [
  { title: "Só Pro Meu Prazer", thumbnail: thumbSoProMeuPrazer },
  { title: "Foi Deus", thumbnail: thumbFoiDeus },
  { title: "Maneira Errada", thumbnail: thumbManeiraErrada },
  { title: "Amigo", thumbnail: thumbAmigo },
];

const SECTION_ID = "videos";

/** Altura do header fixo (--header-height): o pin começa logo abaixo dele. */
function headerHeight() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 0;
}

export function Videos() {
  const stageRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);

  // O stage é o trigger e fica pinado (não é animado); frase, grade e título são os alvos.
  useGSAP(
    () => {
      const mm = createCinematicTimeline(
        {
          stage: stageRef.current!,
          text: textRef.current!,
          media: gridRef.current!,
          caption: titleRef.current!,
        },
        VIDEOS_CINEMATIC,
        headerHeight,
      );
      return () => mm.revert();
    },
    { dependencies: [VIDEOS_CINEMATIC], revertOnUpdate: true },
  );

  // Âncora #videos (topbar ou URL) vai direto para o fim da timeline: os vídeos já
  // aparecem na tela sem precisar rolar pela sequência.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.(`a[href="#${SECTION_ID}"]`);
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
      if (!scrollToCinematicEnd()) return; // sem timeline: âncora normal
      event.preventDefault();
      history.pushState(null, "", `#${SECTION_ID}`);
    };

    // Página aberta já com #videos: espera o load (fontes/imagens mudam a altura da página).
    const onLoad = () => {
      if (location.hash === `#${SECTION_ID}`) scrollToCinematicEnd();
    };

    document.addEventListener("click", onClick);
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("load", onLoad);
    };
  }, []);

  return (
    <section id={SECTION_ID} className={styles.videos} aria-labelledby="videos-title">
      <div ref={stageRef} className={`container-narrow ${styles.stage}`}>
        <p ref={textRef} className={`type-body ${styles.intro}`}>
          Agora queremos compartilhar um pouco desse trabalho com vocês.
        </p>
        <h2 ref={titleRef} id="videos-title" className={`type-title ${styles.title}`}>
          VIDEOS
        </h2>
        <ul ref={gridRef} className={styles.grid}>
          {VIDEOS.map((video) => (
            <VideoCard key={video.title} video={video} />
          ))}
        </ul>
      </div>
      <div className="container-narrow">
        <p className={`type-body ${styles.closing}`}>
          Do show com banda completa, para quem busca uma experiência mais completa e marcante, ao
          voz e violão, para eventos mais intimistas.
        </p>
      </div>
    </section>
  );
}
