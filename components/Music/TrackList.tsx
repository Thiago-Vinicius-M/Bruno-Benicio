import type { MusicTrack } from "./musicTracks";
import styles from "./Music.module.css";

type TrackListProps = {
  tracks: MusicTrack[];
  activeIndex: number;
  onSelect: (index: number) => void;
  /** id do player que a lista controla (aria-controls) */
  playerId: string;
};

/** Número com dois dígitos: 1 → "01". */
function trackNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

/**
 * Lista de músicas: cada item é um botão que troca a música do player.
 * aria-pressed indica a selecionada — sem depender de cor nem de hover.
 */
export function TrackList({ tracks, activeIndex, onSelect, playerId }: TrackListProps) {
  return (
    <ol className={styles.tracks} aria-label="Músicas">
      {tracks.map((track, index) => {
        const active = index === activeIndex;
        return (
          <li key={track.id} data-reveal="tracks">
            <button
              type="button"
              className={styles.track}
              aria-pressed={active}
              aria-controls={playerId}
              onClick={() => onSelect(index)}
            >
              <span className={styles.trackNumber} aria-hidden="true">
                {trackNumber(index)}
              </span>
              <span className={`type-caption ${styles.trackTitle}`}>{track.title}</span>
              <IconBars className={styles.trackIcon} />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function IconBars({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <rect x="2" y="6" width="2" height="8" rx="1" />
      <rect x="7" y="2" width="2" height="12" rx="1" />
      <rect x="12" y="8" width="2" height="6" rx="1" />
    </svg>
  );
}
