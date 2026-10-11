"use client";

import Image from "next/image";
import { useEffect, useId, useState, useTransition, type FormEvent } from "react";
import { parseYouTubeId, youTubeThumbnailUrl } from "@/components/VideoGallery/youtube";
import { isAgendaError } from "@/lib/agenda/errors";
import type { VideoActionResult } from "@/lib/painel/videos";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { removeUnusedAssets, storagePath, uploadProblem, uploadVideoAsset, UPLOAD_TYPES } from "@/lib/videos/storage";
import type { Video, VideoInput, VideoOrientationValue, VideoPlacement, VideoSource } from "@/lib/videos/types";
import { normalizeMediaPath, suggestedYouTubeOrientation, toVideoRow } from "@/lib/videos/videoInput";
import styles from "../Painel.module.css";
import { PLACEMENT_LABEL, PLACEMENTS } from "./placement";
import css from "./Videos.module.css";

type Props = {
  video?: Video;
  /** Vídeo principal atual (para avisar que ele será substituído). */
  currentMain: Video | null;
  save: (input: VideoInput) => Promise<VideoActionResult>;
  onSaved: (message: string) => void;
  onCancel: () => void;
  /** avisa o Dialog para não fechar no meio do envio */
  onBusyChange: (busy: boolean) => void;
};

const NETWORK_ERROR = "Não foi possível concluir a operação. Verifique a conexão e tente novamente.";
const UPLOAD_ERROR = "Não foi possível enviar o arquivo. Verifique a conexão e tente novamente.";

const safeDecode = (value: string) => {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
};

/** Valor salvo → texto do campo (caminho legível; upload do painel não aparece como texto). */
const displayPath = (value: string | null | undefined) => (value && !storagePath(value) ? safeDecode(value) : "");

const megabytes = (file: File) => `${(file.size / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;

/** Formato do mp4 pelos metadados (sem baixar o vídeo inteiro). */
function readOrientation(file: File): Promise<VideoOrientationValue | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    const done = (value: VideoOrientationValue | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    probe.preload = "metadata";
    probe.onloadedmetadata = () =>
      done(probe.videoWidth && probe.videoHeight ? (probe.videoWidth >= probe.videoHeight ? "landscape" : "portrait") : null);
    probe.onerror = () => done(null);
    probe.src = url;
  });
}

/** Imagem escolhida + URL temporária para a pré-visualização (liberada ao trocar/fechar). */
type ChosenImage = { file: File; url: string };

function useRevokeOnChange(url: string | undefined) {
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
}

const PLACEMENT_HINT: Record<VideoPlacement, string> = {
  main: "O maior destaque da Home, sempre na primeira posição. Pode ser vertical ou horizontal.",
  secondary: "Entra na Home depois do principal, na ordem da lista, até o limite de cada tela.",
  gallery: "Fica só na galeria completa do “Ver mais”.",
};

/**
 * Cadastro/edição de vídeo: YouTube (link) ou arquivo .mp4 (enviado aqui ou caminho já
 * existente no site), capa opcional, formato (orientação) e classificação editorial. Os
 * arquivos sobem direto do navegador para o Storage; a Server Action recebe só as URLs.
 * Se salvar falhar, os arquivos recém-enviados são apagados.
 */
export function VideoForm({ video, currentMain, save, onSaved, onCancel, onBusyChange }: Props) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();

  const [sourceType, setSourceType] = useState<VideoSource>(video?.source_type ?? "youtube");
  const [youtube, setYoutube] = useState(video?.source_type === "youtube" ? `https://youtu.be/${video.source}` : "");
  const [filePath, setFilePath] = useState(video?.source_type === "local" ? displayPath(video.source) : "");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [posterPath, setPosterPath] = useState(displayPath(video?.poster));
  const [posterChoice, setPosterChoice] = useState<ChosenImage | null>(null);
  const posterFile = posterChoice?.file ?? null;
  const [keptUpload, setKeptUpload] = useState({
    // Arquivos já enviados pelo painel: continuam valendo até serem trocados ou removidos.
    file: video?.source_type === "local" && storagePath(video.source) ? video.source : null,
    poster: storagePath(video?.poster) ? video!.poster : null,
  });
  const [orientation, setOrientation] = useState<VideoOrientationValue>(
    video?.orientation ?? (sourceType === "youtube" ? "landscape" : "portrait"),
  );
  const [orientationTouched, setOrientationTouched] = useState(Boolean(video));

  const [placement, setPlacement] = useState<VideoPlacement>(video?.placement ?? "secondary");
  // Escolher "Principal" com outro principal cadastrado: ele é rebaixado ao salvar.
  const replacesMain = placement === "main" && currentMain !== null && currentMain.id !== video?.id;
  // Principal precisa estar no site.
  const mainBlocked = video !== undefined && !video.active && video.placement !== "main";

  useEffect(() => onBusyChange(pending), [pending, onBusyChange]);

  useRevokeOnChange(posterChoice?.url);
  const youtubeId = sourceType === "youtube" ? parseYouTubeId(youtube) : null;
  const typedPoster = normalizeMediaPath(posterPath);
  const preview =
    posterChoice?.url ??
    (typeof typedPoster === "string" ? typedPoster : null) ??
    keptUpload.poster ??
    (youtubeId ? youTubeThumbnailUrl(youtubeId) : null);

  function changeOrientation(value: VideoOrientationValue) {
    setOrientation(value);
    setOrientationTouched(true);
  }

  function changeYoutube(value: string) {
    setYoutube(value);
    if (!orientationTouched) setOrientation(suggestedYouTubeOrientation(value));
  }

  async function chooseVideoFile(file: File | null) {
    setError(file ? (uploadProblem(file, "video") ?? undefined) : undefined);
    setVideoFile(file);
    if (file && !orientationTouched) {
      const detected = await readOrientation(file);
      if (detected) setOrientation(detected);
    }
  }

  function choosePosterFile(file: File | null) {
    setError(file ? (uploadProblem(file, "poster") ?? undefined) : undefined);
    setPosterChoice(file ? { file, url: URL.createObjectURL(file) } : null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const title = String(new FormData(event.currentTarget).get("title") ?? "");
    const base: VideoInput = {
      title,
      sourceType,
      youtube,
      file: keptUpload.file ?? filePath,
      poster: keptUpload.poster ?? posterPath,
      orientation,
      placement,
    };

    // Valida tudo ANTES de enviar arquivos (no lugar deles, nomes provisórios).
    const problem =
      (sourceType === "local" && videoFile && uploadProblem(videoFile, "video")) ||
      (posterFile && uploadProblem(posterFile, "poster")) ||
      null;
    if (problem) {
      setError(problem);
      return;
    }
    try {
      toVideoRow({
        ...base,
        file: sourceType === "local" && videoFile ? "/enviando.mp4" : base.file,
        poster: posterFile ? "/enviando.jpg" : base.poster,
      });
    } catch (invalid) {
      setError(isAgendaError(invalid) ? invalid.message : "Dados inválidos.");
      return;
    }
    setError(undefined);

    startTransition(async () => {
      const client = getSupabaseBrowserClient();
      const uploaded: string[] = [];
      let stage: "upload" | "save" = "upload";
      try {
        const input = { ...base };
        if (sourceType === "local" && videoFile) {
          setStatus(`Enviando vídeo (${megabytes(videoFile)})…`);
          input.file = await uploadVideoAsset(client, videoFile, "video");
          uploaded.push(input.file);
        }
        if (posterFile) {
          setStatus("Enviando capa…");
          input.poster = await uploadVideoAsset(client, posterFile, "poster");
          uploaded.push(input.poster);
        }

        setStatus("Salvando…");
        stage = "save";
        const result = await save(input);
        if (result.status === "success") {
          onSaved(result.message);
          return;
        }
        await removeUnusedAssets(client, uploaded);
        setError(result.message);
      } catch (failure) {
        await removeUnusedAssets(client, uploaded).catch(() => {});
        console.error("[videos] falha ao enviar/salvar", failure);
        setError(stage === "upload" ? UPLOAD_ERROR : NETWORK_ERROR);
      } finally {
        setStatus(undefined);
      }
    });
  }

  const field = (name: string) => `${id}-${name}`;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {error && (
        <p role="alert" className={`${styles.alert} ${styles.alertError}`}>
          {error}
        </p>
      )}

      <div className={styles.field}>
        <label htmlFor={field("title")} className={styles.label}>
          Título *
        </label>
        <input
          id={field("title")}
          name="title"
          required
          maxLength={160}
          autoComplete="off"
          defaultValue={video?.title}
          className={styles.input}
        />
      </div>

      <fieldset className={css.fieldset}>
        <legend className={styles.label}>Origem *</legend>
        <div className={css.segmented}>
          {(
            [
              ["youtube", "Link do YouTube"],
              ["local", "Arquivo .mp4"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={css.segment}>
              <input
                type="radio"
                name="sourceType"
                value={value}
                checked={sourceType === value}
                onChange={() => setSourceType(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {sourceType === "youtube" ? (
        <div className={styles.field}>
          <label htmlFor={field("youtube")} className={styles.label}>
            Link do YouTube *
          </label>
          <input
            id={field("youtube")}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://youtu.be/…"
            aria-describedby={field("youtube-hint")}
            value={youtube}
            onChange={(event) => changeYoutube(event.target.value)}
            className={styles.input}
          />
          <p id={field("youtube-hint")} className={styles.hint}>
            Qualquer link do vídeo (compartilhar, navegador ou Shorts). O vídeo toca no próprio site.
          </p>
        </div>
      ) : (
        <div className={styles.field}>
          <span className={styles.label} id={field("file-label")}>
            Vídeo .mp4 *
          </span>
          {videoFile || keptUpload.file ? (
            <p className={css.chosen}>
              <span>{videoFile ? `${videoFile.name} · ${megabytes(videoFile)}` : "Arquivo enviado pelo painel"}</span>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonGhost} ${css.small}`}
                onClick={() => {
                  setVideoFile(null);
                  setKeptUpload((kept) => ({ ...kept, file: null }));
                }}
              >
                Trocar
              </button>
            </p>
          ) : (
            <>
              <input
                type="file"
                accept={UPLOAD_TYPES.video.accept.join(",")}
                aria-labelledby={field("file-label")}
                className={css.file}
                onChange={(event) => chooseVideoFile(event.target.files?.[0] ?? null)}
              />
              <label htmlFor={field("file")} className={styles.hint}>
                ou o caminho de um arquivo que já está no site:
              </label>
              <input
                id={field("file")}
                autoComplete="off"
                spellCheck={false}
                placeholder="/videos/nome-do-video.mp4"
                value={filePath}
                onChange={(event) => setFilePath(event.target.value)}
                className={styles.input}
              />
            </>
          )}
          <p className={styles.hint}>Até 50 MB. Vídeos mais pesados: comprima ou publique no YouTube.</p>
        </div>
      )}

      <div className={styles.field}>
        <span className={styles.label} id={field("poster-label")}>
          Imagem de capa {sourceType === "youtube" ? "(opcional)" : "(recomendada)"}
        </span>
        <div className={css.posterRow}>
          <div className={css.posterPreview} data-orientation={orientation}>
            {preview ? (
              <Image src={preview} alt="" fill unoptimized sizes="120px" className={css.posterImage} />
            ) : (
              <span>{sourceType === "local" ? "1º quadro do vídeo" : "sem capa"}</span>
            )}
          </div>
          <div className={css.posterFields}>
            {posterFile || keptUpload.poster ? (
              <p className={css.chosen}>
                <span>{posterFile ? posterFile.name : "Imagem enviada pelo painel"}</span>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonGhost} ${css.small}`}
                  onClick={() => {
                    setPosterChoice(null);
                    setKeptUpload((kept) => ({ ...kept, poster: null }));
                  }}
                >
                  Remover
                </button>
              </p>
            ) : (
              <>
                <input
                  type="file"
                  accept={UPLOAD_TYPES.poster.accept.join(",")}
                  aria-labelledby={field("poster-label")}
                  className={css.file}
                  onChange={(event) => choosePosterFile(event.target.files?.[0] ?? null)}
                />
                <label htmlFor={field("poster")} className={styles.hint}>
                  ou o caminho da imagem:
                </label>
                <input
                  id={field("poster")}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="/videos/capa.jpg"
                  value={posterPath}
                  onChange={(event) => setPosterPath(event.target.value)}
                  className={styles.input}
                />
              </>
            )}
          </div>
        </div>
        <p className={styles.hint}>
          {sourceType === "youtube"
            ? "Sem capa, usa a imagem do próprio YouTube."
            : "Sem capa, o card mostra o primeiro quadro do vídeo."}
        </p>
      </div>

      <fieldset className={css.fieldset}>
        <legend className={styles.label}>Formato *</legend>
        <div className={css.segmented}>
          {(
            [
              ["landscape", "Horizontal · 16:9"],
              ["portrait", "Vertical · 9:16"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={css.segment}>
              <input
                type="radio"
                name="orientation"
                value={value}
                checked={orientation === value}
                onChange={() => changeOrientation(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {!orientationTouched && (
          <p className={styles.hint}>Detectado automaticamente; ajuste se precisar.</p>
        )}
      </fieldset>

      <fieldset className={css.fieldset} aria-describedby={field("placement-hint")}>
        <legend className={styles.label}>Onde aparece *</legend>
        <div className={`${css.segmented} ${css.segmented3}`}>
          {PLACEMENTS.map((value) => (
            <label key={value} className={css.segment}>
              <input
                type="radio"
                name="placement"
                value={value}
                checked={placement === value}
                disabled={value === "main" && mainBlocked}
                onChange={() => setPlacement(value)}
              />
              <span>{PLACEMENT_LABEL[value]}</span>
            </label>
          ))}
        </div>
        <p id={field("placement-hint")} className={styles.hint}>
          {PLACEMENT_HINT[placement]}
          {mainBlocked && " Para ser o principal, o vídeo precisa estar ativo."}
        </p>
        {replacesMain && (
          <p role="status" className={`${styles.alert} ${css.warning}`}>
            Ao salvar, este vídeo substitui “{currentMain.title}” como principal. O anterior passa a ser o primeiro
            secundário.
          </p>
        )}
      </fieldset>

      {status && (
        <p role="status" className={styles.hint}>
          {status}
        </p>
      )}

      <div className={styles.dialogActions}>
        <button type="button" className={`${styles.button} ${styles.buttonGhost}`} onClick={onCancel} disabled={pending}>
          Cancelar
        </button>
        <button type="submit" className={styles.button} disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
