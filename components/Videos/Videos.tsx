"use client";

import { useEffect, useRef } from "react";
import { useGSAP } from "@/animations/gsap";
import { createCinematicTimeline, scrollToCinematicEnd } from "@/animations/cinematicTimeline";
import { MoreButton } from "@/components/Experience/MoreButton";
import { VideoGallery } from "@/components/VideoGallery/VideoGallery";
import type { GalleryVideo } from "@/components/VideoGallery/types";
import { splitHomeVideos } from "@/lib/videos/gallery";
import { useVideoCollection } from "./videosContext";
import { VIDEOS_CINEMATIC } from "./videosCinematic";
import styles from "./Videos.module.css";

const SECTION_ID = "videos";

/** Altura do header fixo (--header-height): o pin começa logo abaixo dele. */
function headerHeight() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 0;
}

/**
 * Seção VIDEOS da Home (painel → Vídeos): o principal (se houver) e os secundários, até o
 * limite de cada dispositivo (lib/videos/gallery.ts). O HTML traz o maior dos dois
 * limites e o CSS esconde o excedente de cada layout, então servidor e navegador renderizam
 * o mesmo (sem divergência de hidratação) e a troca acompanha redimensionar/girar a tela.
 * O "Ver mais" abre a galeria com o restante e só aparece no layout em que sobra algum.
 * Sem vídeos ativos, a seção não aparece.
 */
export function Videos() {
  const collection = useVideoCollection();
  const desktop = splitHomeVideos(collection, collection.limits.desktop);
  const mobile = splitHomeVideos(collection, collection.limits.mobile);
  // Os dois são prefixos da mesma lista: o maior contém o menor.
  const home = desktop.home.length >= mobile.home.length ? desktop.home : mobile.home;
  if (!home.length && !desktop.more.length) return null;

  return (
    <VideosSection
      videos={home}
      desktopCount={desktop.home.length}
      mobileCount={mobile.home.length}
      leadId={collection.main?.id}
      more={{ desktop: desktop.more.length > 0, mobile: mobile.more.length > 0 }}
    />
  );
}

type VideosSectionProps = {
  videos: GalleryVideo[];
  desktopCount: number;
  mobileCount: number;
  leadId?: string;
  /** Há vídeos para o "Ver mais" em cada layout? */
  more: { desktop: boolean; mobile: boolean };
};

function VideosSection({ videos, desktopCount, mobileCount, leadId, more }: VideosSectionProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  // O stage é o trigger e fica pinado (não é animado); frase, galeria e título são os alvos.
  useGSAP(
    () => {
      const mm = createCinematicTimeline(
        {
          stage: stageRef.current!,
          text: textRef.current!,
          media: galleryRef.current!,
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
        <VideoGallery
          ref={galleryRef}
          videos={videos}
          desktopCount={desktopCount}
          mobileCount={mobileCount}
          leadId={leadId}
          className={styles.gallery}
        />
      </div>
      {/* A Home mostra o principal e os secundários; os demais vídeos abrem numa subtela. */}
      {(more.desktop || more.mobile) && (
        <div
          className={`container-narrow ${styles.more}`}
          data-hide-desktop={!more.desktop || undefined}
          data-hide-mobile={!more.mobile || undefined}
        >
          <MoreButton experience="videos" />
        </div>
      )}
    </section>
  );
}
