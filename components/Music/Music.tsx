"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP } from "@/animations/gsap";
import { createFadeSlide } from "@/animations/fadeSlide";
import { SpotifyPlayer } from "@/components/SpotifyPlayer/SpotifyPlayer";
import { MUSIC_REVEAL } from "./musicReveal";
import { MUSIC_TRACKS, SPOTIFY_ARTIST_URL, type MusicTrack } from "./musicTracks";
import { TrackList } from "./TrackList";
import styles from "./Music.module.css";

const PLAYER_ID = "musicas-player";

type RevealGroup = "heading" | "decor" | "player" | "tracks";

type MusicProps = {
  /** padrão: MUSIC_TRACKS (musicTracks.ts) */
  tracks?: MusicTrack[];
  artistUrl?: string;
};

/**
 * Seção MÚSICAS: um único player oficial do Spotify + lista para escolher a música.
 * Só um iframe existe por vez; selecionar outra música troca o player.
 */
export function Music({ tracks = MUSIC_TRACKS, artistUrl = SPOTIFY_ARTIST_URL }: MusicProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const active = tracks[activeIndex] ?? tracks[0];

  // O stage é o trigger (não é animado); os alvos são marcados com data-reveal no JSX.
  useGSAP(
    () => {
      const stage = stageRef.current!;
      const group = (name: RevealGroup) =>
        gsap.utils.toArray<HTMLElement>(`[data-reveal="${name}"]`, stage);

      const { heading, decor, player, tracks: trackStep, ...params } = MUSIC_REVEAL;
      const mm = createFadeSlide(
        stage,
        [
          { ...heading, targets: group("heading") },
          { ...decor, targets: group("decor") },
          { ...player, targets: group("player") },
          { ...trackStep, targets: group("tracks") },
        ],
        params,
      );
      return () => mm.revert();
    },
    { dependencies: [MUSIC_REVEAL], revertOnUpdate: true },
  );

  return (
    <section id="musicas" className={styles.music} aria-labelledby="musicas-title">
      <div ref={stageRef} className={`container-narrow ${styles.stage}`}>
        <header className={styles.intro}>
          <h2 id="musicas-title" className="type-title" data-reveal="heading">
            MÚSICAS
          </h2>
        </header>

        {active ? (
          <div className={styles.layout}>
            <div className={styles.stageLight}>
              <span className={styles.glow} data-reveal="decor" aria-hidden="true" />
              <div data-reveal="player">
                <SpotifyPlayer id={PLAYER_ID} trackId={active.id} title={active.title} variant="adaptive" />
              </div>
            </div>

            <div className={styles.side}>
              <TrackList
                tracks={tracks}
                activeIndex={activeIndex}
                onSelect={setActiveIndex}
                playerId={PLAYER_ID}
              />
              <a
                href={artistUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`type-nav ${styles.cta}`}
                data-reveal="tracks"
              >
                OUÇA MAIS NO SPOTIFY
                <span className={styles.srOnly}> (abre em nova aba)</span>
                <IconArrow />
              </a>
            </div>
          </div>
        ) : null}        

        {/* Anuncia a troca de música para leitores de tela. */}
        <p className={styles.srOnly} aria-live="polite">
          {active ? `Música selecionada: ${active.title}` : ""}
        </p>
      </div>
    </section>
  );
}

function IconArrow() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5 11 11 5M6 5h5v5" fill="none" />
    </svg>
  );
}
