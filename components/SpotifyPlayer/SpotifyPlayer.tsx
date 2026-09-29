import { buildSpotifyEmbedUrl, type SpotifyEmbedTheme } from "./spotifyEmbed";
import styles from "./SpotifyPlayer.module.css";

/**
 * Altura do player — o Spotify troca o layout interno conforme a altura do iframe.
 *   compact  → 152px: faixa horizontal (capa pequena + controles)
 *   standard → 352px: capa grande em cima, controles embaixo
 *   adaptive → compact no celular (≤ 767px) e standard a partir do tablet
 * Para outra altura, defina --spotify-height na className.
 */
export type SpotifyPlayerVariant = "compact" | "standard" | "adaptive";

const FALLBACK_HEIGHT: Record<SpotifyPlayerVariant, number> = {
  compact: 152,
  standard: 352,
  adaptive: 352,
};

export type SpotifyPlayerProps = {
  /** Track ID do Spotify (22 caracteres). Inválido ou vazio → aviso no lugar do player. */
  trackId: string | null | undefined;
  /** Nome da música — usado no título acessível do iframe. */
  title: string;
  variant?: SpotifyPlayerVariant;
  theme?: SpotifyEmbedTheme;
  /** "lazy" (padrão) só carrega o iframe perto da área visível. */
  loading?: "lazy" | "eager";
  id?: string;
  className?: string;
};

/** Player oficial do Spotify (iframe). Visual interno e reprodução são do Spotify. */
export function SpotifyPlayer({
  trackId,
  title,
  variant = "adaptive",
  theme = "dark",
  loading = "lazy",
  id,
  className,
}: SpotifyPlayerProps) {
  const src = buildSpotifyEmbedUrl(trackId, theme);
  const classes = className ? `${styles.player} ${className}` : styles.player;

  return (
    <div id={id} className={classes} data-variant={variant}>
      {src ? (
        // key = src: trocar de música monta um iframe novo em vez de navegar o atual,
        // o que evitaria uma entrada extra no histórico (botão Voltar) a cada troca.
        <iframe
          key={src}
          src={src}
          title={`Player do Spotify: ${title}`}
          className={styles.frame}
          width="100%"
          height={FALLBACK_HEIGHT[variant]}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          loading={loading}
        />
      ) : (
        <p role="note" className={`type-body ${styles.fallback}`}>
          Música indisponível no momento.
        </p>
      )}
    </div>
  );
}
