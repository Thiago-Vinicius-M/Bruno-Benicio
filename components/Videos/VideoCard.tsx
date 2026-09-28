"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Image, { type StaticImageData } from "next/image";
import { MEDIA } from "@/animations/media";
import styles from "./Videos.module.css";

export type Video = {
  title: string;
  thumbnail: StaticImageData;
  /** arquivo do vídeo; sem ele o card mostra só a thumbnail */
  src?: string;
};

type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/**
 * Card em destaque ("engaged"): cresce um pouco e mostra os botões de som e tela cheia.
 *   Desktop → mouse em cima do card.
 *   Celular → card centralizado no carrossel (arrastando para os lados).
 * Com vídeo, o destaque também dá play (mudo); ao sair, pausa e volta a ficar mudo.
 */
export function VideoCard({ video }: { video: Video }) {
  const cardRef = useRef<HTMLLIElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<WebkitVideo>(null);
  const [engaged, setEngaged] = useState(false);
  const [muted, setMuted] = useState(true);

  function engage(next: boolean) {
    setEngaged(next);
    const player = videoRef.current;
    if (!player) return;
    if (next) {
      player.play().catch(() => {});
    } else {
      player.pause();
      player.muted = true;
      setMuted(true);
    }
  }

  function toggleMuted() {
    const player = videoRef.current;
    if (!player) return;
    player.muted = !player.muted;
    setMuted(player.muted);
    if (!player.muted) player.play().catch(() => {});
  }

  function enterFullscreen() {
    const player = videoRef.current;
    const target = player ?? frameRef.current;
    if (target?.requestFullscreen) target.requestFullscreen().catch(() => {});
    else player?.webkitEnterFullscreen?.(); // Safari do iPhone: só vídeo entra em tela cheia
  }

  const onVisibility = useEffectEvent((ratio: number) => engage(ratio >= 0.75));

  // Celular: o card em destaque é o que está (quase) inteiro dentro do carrossel.
  useEffect(() => {
    const card = cardRef.current;
    const carousel = card?.parentElement;
    if (!card || !carousel) return;

    const mobile = window.matchMedia(MEDIA.isMobile);
    let observer: IntersectionObserver | null = null;

    const setup = () => {
      observer?.disconnect();
      observer = null;
      if (!mobile.matches) return;
      observer = new IntersectionObserver(([entry]) => onVisibility(entry.intersectionRatio), {
        root: carousel,
        threshold: [0, 0.75, 1],
      });
      observer.observe(card);
    };

    setup();
    mobile.addEventListener("change", setup);
    return () => {
      mobile.removeEventListener("change", setup);
      observer?.disconnect();
    };
  }, []);

  const label = `Vídeo: ${video.title}`;

  return (
    <li
      ref={cardRef}
      className={styles.item}
      data-engaged={engaged}
      onPointerEnter={(event) => event.pointerType === "mouse" && engage(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && engage(false)}
    >
      <div className={styles.card}>
        <div ref={frameRef} className={styles.frame}>
          {video.src ? (
            <video
              ref={videoRef}
              src={video.src}
              poster={video.thumbnail.src}
              aria-label={label}
              className={styles.thumbnail}
              muted
              loop
              playsInline
              preload="metadata"
            />
          ) : (
            <Image
              src={video.thumbnail}
              width={496}
              height={279}
              alt={label}
              className={styles.thumbnail}
            />
          )}
        </div>

        <div className={styles.controls}>
          <button
            type="button"
            className={styles.control}
            onClick={toggleMuted}
            disabled={!video.src}
            aria-label={muted ? "Ativar som" : "Desativar som"}
            title={video.src ? undefined : "Vídeo em breve"}
          >
            {muted ? <IconMuted /> : <IconSound />}
          </button>
          <button
            type="button"
            className={styles.control}
            onClick={enterFullscreen}
            aria-label="Tela cheia"
          >
            <IconFullscreen />
          </button>
        </div>
      </div>
    </li>
  );
}

function IconMuted() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="m16.5 9.5 5 5m0-5-5 5" fill="none" />
    </svg>
  );
}

function IconSound() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" />
    </svg>
  );
}

function IconFullscreen() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" />
    </svg>
  );
}
