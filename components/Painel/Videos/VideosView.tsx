"use client";

import Image from "next/image";
import { useCallback, useState, useTransition } from "react";
import {
  createVideoAction,
  deleteVideoAction,
  moveVideoAction,
  setVideoActiveAction,
  setVideoPlacementAction,
  updateVideoAction,
} from "@/app/painel/(area)/videos/actions";
import { resolveThumbnail } from "@/components/VideoGallery/videoSources";
import type { VideoActionResult } from "@/lib/painel/videos";
import { formatTimestamp } from "@/lib/painel/showFormat";
import { splitHomeVideos, toGalleryVideo, toVideoCollection } from "@/lib/videos/gallery";
import { storagePath } from "@/lib/videos/storage";
import type { Video, VideoHomeLimits, VideoInput, VideoPlacement } from "@/lib/videos/types";
import { Dialog } from "../Dialog";
import styles from "../Painel.module.css";
import { useToast } from "../Toast";
import agenda from "../Agenda/Agenda.module.css";
import users from "../Usuarios/Users.module.css";
import { HomeLimitsForm } from "./HomeLimitsForm";
import { LayoutPreview } from "./LayoutPreview";
import { PLACEMENT_LABEL, PLACEMENTS } from "./placement";
import { VideoForm } from "./VideoForm";
import css from "./Videos.module.css";

type Props = {
  /** Todos (ativos e inativos), na ordem de exibição (position). */
  videos: Video[];
  limits: VideoHomeLimits;
  /** Nomes da equipe por id, para exibir a auditoria. */
  authors: Record<string, string>;
};

const NETWORK_ERROR = "Não foi possível concluir a operação. Verifique a conexão e tente novamente.";

const ORIENTATION = { landscape: "Horizontal", portrait: "Vertical" } as const;

function sourceLabel(video: Video) {
  if (video.source_type === "youtube") return "YouTube";
  return storagePath(video.source) ? "Arquivo enviado" : "Arquivo do site";
}

export function VideosView({ videos, limits, authors }: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Video | "new" | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [deleting, setDeleting] = useState<Video | null>(null);
  const [promoting, setPromoting] = useState<Video | null>(null);

  const main = videos.find((video) => video.placement === "main") ?? null;
  const secondary = videos.filter((video) => video.placement === "secondary");
  const galleryOnly = videos.filter((video) => video.placement === "gallery");

  // Mesma regra do site: o que cada tela mostra na Home e o que vai para o "Ver mais".
  const collection = toVideoCollection(videos, limits);
  const desktop = splitHomeVideos(collection, limits.desktop);
  const mobile = splitHomeVideos(collection, limits.mobile);
  const onDesktop = new Set(desktop.home.map((video) => video.id));
  const onMobile = new Set(mobile.home.map((video) => video.id));

  function whereShown(video: Video) {
    if (!video.active) return "Fora do site";
    const inDesktop = onDesktop.has(video.id);
    const inMobile = onMobile.has(video.id);
    if (inDesktop && inMobile) return "Home no computador e no celular";
    if (inDesktop) return "Home no computador · “Ver mais” no celular";
    if (inMobile) return "Home no celular · “Ver mais” no computador";
    return "“Ver mais”";
  }

  const author = (id: string | null) => (id ? (authors[id] ?? "usuário removido") : "importado do site");

  /** Executa uma Server Action sem envios paralelos; a lista volta revalidada. */
  function perform(id: string, action: () => Promise<VideoActionResult>, onSuccess?: () => void) {
    if (pending) return;
    setBusyId(id);
    startTransition(async () => {
      let result: VideoActionResult;
      try {
        result = await action();
      } catch {
        result = { status: "error", message: NETWORK_ERROR };
      }
      setBusyId(null);
      if (result.status === "success") {
        onSuccess?.();
        // Mudar a ordem é frequente: sem aviso, a própria lista mostra o resultado.
        if (result.message !== "Ordem atualizada.") toast(result.message);
      } else {
        toast(result.message, "error");
      }
    });
  }

  function changePlacement(video: Video, placement: VideoPlacement) {
    if (placement === video.placement) return;
    // Trocar o principal pede confirmação: o atual deixa de ser o destaque.
    if (placement === "main" && main && main.id !== video.id) {
      setPromoting(video);
      return;
    }
    perform(video.id, () => setVideoPlacementAction(video.id, placement));
  }

  const save = useCallback(
    (input: VideoInput) => {
      const target = editing;
      if (!target) return Promise.resolve<VideoActionResult>({ status: "error", message: "Vídeo inválido." });
      return target === "new" ? createVideoAction(input) : updateVideoAction(target.id, input);
    },
    [editing],
  );

  const onSaved = useCallback(
    (message: string) => {
      setEditing(null);
      toast(message);
    },
    [toast],
  );

  function renderGroup(list: Video[], orderable: boolean) {
    return (
      <ol className={agenda.list}>
        {list.map((video, index) => {
          const thumbnail = resolveThumbnail(toGalleryVideo(video));
          const src = typeof thumbnail === "string" ? thumbnail : thumbnail?.src;
          const busy = busyId === video.id;
          return (
            <li
              key={video.id}
              className={css.item}
              data-inactive={!video.active || undefined}
              aria-busy={busy || undefined}
            >
              <span className={css.number}>{index + 1}</span>
              <span className={css.thumb} data-orientation={video.orientation}>
                {src ? <Image src={src} alt="" fill unoptimized sizes="96px" className={css.thumbImage} /> : null}
              </span>
              <div className={css.info}>
                <p className={css.title}>
                  {video.title}
                  <span className={users.state} data-state={video.active ? "active" : "inactive"}>
                    {video.active ? "Ativo" : "Inativo"}
                  </span>
                </p>
                <p className={agenda.meta}>
                  {sourceLabel(video)} · {ORIENTATION[video.orientation]}
                  {!video.poster && video.source_type === "local" && " · sem capa"}
                </p>
                <p className={css.where}>{whereShown(video)}</p>
              </div>
              {orderable && (
                <div className={css.order} role="group" aria-label={`Ordem de ${video.title}`}>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonGhost} ${css.iconButton}`}
                    aria-label={`Subir ${video.title}`}
                    disabled={pending || index === 0}
                    onClick={() => perform(video.id, () => moveVideoAction(video.id, "up"))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonGhost} ${css.iconButton}`}
                    aria-label={`Descer ${video.title}`}
                    disabled={pending || index === list.length - 1}
                    onClick={() => perform(video.id, () => moveVideoAction(video.id, "down"))}
                  >
                    ↓
                  </button>
                </div>
              )}
              <div className={`${agenda.actions} ${css.actions}`}>
                <select
                  aria-label={`Classificação de ${video.title}`}
                  className={`${styles.input} ${css.placement}`}
                  value={video.placement}
                  disabled={pending}
                  onChange={(event) => changePlacement(video, event.target.value as VideoPlacement)}
                >
                  {PLACEMENTS.map((placement) => (
                    <option
                      key={placement}
                      value={placement}
                      // Principal precisa estar no site: ative antes de promover.
                      disabled={placement === "main" && !video.active && video.placement !== "main"}
                    >
                      {placement === "main" && main && main.id !== video.id
                        ? "Tornar principal"
                        : PLACEMENT_LABEL[placement]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonGhost} ${agenda.action}`}
                  aria-label={`${video.active ? "Desativar" : "Ativar"} ${video.title}`}
                  disabled={pending}
                  onClick={() => perform(video.id, () => setVideoActiveAction(video.id, !video.active))}
                >
                  {video.active ? "Desativar" : "Ativar"}
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonGhost} ${agenda.action}`}
                  aria-label={`Editar ${video.title}`}
                  disabled={pending}
                  onClick={() => setEditing(video)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonGhost} ${agenda.action} ${agenda.danger}`}
                  aria-label={`Excluir ${video.title}`}
                  disabled={pending}
                  onClick={() => setDeleting(video)}
                >
                  Excluir
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <>
      <HomeLimitsForm limits={limits} />

      <div className={agenda.toolbar}>
        <button type="button" className={styles.button} onClick={() => setEditing("new")}>
          + Novo vídeo
        </button>
      </div>

      {videos.length === 0 ? (
        <div className={agenda.empty}>
          <p>Nenhum vídeo cadastrado. A seção VIDEOS da Home fica oculta até o primeiro vídeo ativo.</p>
          <button type="button" className={styles.button} onClick={() => setEditing("new")}>
            + Adicionar vídeo
          </button>
        </div>
      ) : (
        <>
          <section className={css.group} aria-labelledby="videos-home">
            <div className={css.groupHeader}>
              <h2 id="videos-home" className={agenda.groupTitle}>
                Home
              </h2>
              <p className={styles.hint}>
                Primeiro o principal, depois os secundários na ordem abaixo, até {limits.desktop} no computador e{" "}
                {limits.mobile} no celular. Os que passarem do limite vão para o “Ver mais”.
              </p>
            </div>
            <div className={css.groupBody}>
              <div className={css.subgroups}>
                <div>
                  <h3 className={css.subgroupTitle}>
                    Principal <span className={css.count}>{main ? 1 : 0}</span>
                  </h3>
                  {main ? (
                    <>
                      {renderGroup([main], false)}
                      {!main.active && (
                        <p className={`${styles.alert} ${css.warning}`}>
                          O principal está desativado: a Home começa pelos secundários. Ative-o ou escolha outro
                          principal.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className={`${styles.hint} ${css.emptyGroup}`}>
                      Nenhum vídeo principal: a Home começa pelos secundários. Para escolher, use “Tornar principal”
                      em qualquer vídeo ativo.
                    </p>
                  )}
                </div>
                <div>
                  <h3 className={css.subgroupTitle}>
                    Secundários <span className={css.count}>{secondary.length}</span>
                  </h3>
                  {secondary.length ? (
                    renderGroup(secondary, true)
                  ) : (
                    <p className={`${styles.hint} ${css.emptyGroup}`}>Nenhum vídeo secundário.</p>
                  )}
                </div>
              </div>
              <LayoutPreview
                videos={desktop.home}
                leadId={collection.main?.id}
                label="Como fica na Home (computador)"
                note={`No celular, os ${mobile.home.length} primeiros, em uma coluna na mesma ordem.`}
              />
            </div>
          </section>

          <section className={css.group} aria-labelledby="videos-galeria">
            <div className={css.groupHeader}>
              <h2 id="videos-galeria" className={agenda.groupTitle}>
                Só no “Ver mais” <span className={css.count}>{galleryOnly.length}</span>
              </h2>
              <p className={styles.hint}>
                Ficam sempre na galeria completa, depois dos que não couberam na Home.
                {desktop.more.length === 0 && mobile.more.length === 0 && " Hoje o botão “Ver mais” não aparece."}
              </p>
            </div>
            <div className={css.groupBody}>
              {galleryOnly.length ? (
                renderGroup(galleryOnly, true)
              ) : (
                <p className={`${styles.hint} ${css.emptyGroup}`}>Nenhum vídeo exclusivo do “Ver mais”.</p>
              )}
              <LayoutPreview videos={desktop.more} label="Como fica no “Ver mais” (computador)" />
            </div>
          </section>
        </>
      )}

      <Dialog
        open={editing !== null}
        title={editing === "new" ? "Novo vídeo" : "Editar vídeo"}
        busy={formBusy}
        onClose={() => setEditing(null)}
      >
        {editing && editing !== "new" && (
          <p className={`${styles.hint} ${agenda.audit}`}>
            Adicionado por {author(editing.created_by)} em {formatTimestamp(editing.created_at)}
            {editing.updated_at !== editing.created_at &&
              ` · Última alteração por ${author(editing.updated_by)} em ${formatTimestamp(editing.updated_at)}`}
          </p>
        )}
        {editing && (
          <VideoForm
            video={editing === "new" ? undefined : editing}
            currentMain={main}
            save={save}
            onSaved={onSaved}
            onCancel={() => setEditing(null)}
            onBusyChange={setFormBusy}
          />
        )}
      </Dialog>

      <Dialog
        open={promoting !== null}
        title="Trocar o vídeo principal?"
        busy={pending}
        onClose={() => setPromoting(null)}
      >
        {promoting && main && (
          <>
            <p className={agenda.confirmShow}>
              <strong>{promoting.title}</strong>
              <span>
                {ORIENTATION[promoting.orientation]} · passa a ser o principal da Home
              </span>
            </p>
            <p className={styles.hint}>
              O principal atual, “{main.title}”, passa a ser o primeiro secundário (continua na Home se couber no
              limite).
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonGhost}`}
                disabled={pending}
                onClick={() => setPromoting(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.button}
                disabled={pending}
                onClick={() =>
                  perform(promoting.id, () => setVideoPlacementAction(promoting.id, "main"), () => setPromoting(null))
                }
              >
                {pending ? "Trocando…" : "Tornar principal"}
              </button>
            </div>
          </>
        )}
      </Dialog>

      <Dialog open={deleting !== null} title="Excluir vídeo?" busy={pending} onClose={() => setDeleting(null)}>
        {deleting && (
          <>
            <p className={agenda.confirmShow}>
              <strong>{deleting.title}</strong>
              <span>
                {sourceLabel(deleting)} · {PLACEMENT_LABEL[deleting.placement]}
              </span>
            </p>
            <p className={styles.hint}>
              O vídeo sai do site e do painel. Para só tirar do site, use “Desativar”.
              {storagePath(deleting.source) || storagePath(deleting.poster)
                ? " Os arquivos enviados pelo painel também são apagados."
                : " Arquivos da pasta do site e vídeos do YouTube não são afetados."}
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonGhost}`}
                disabled={pending}
                onClick={() => setDeleting(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonDanger}`}
                disabled={pending}
                onClick={() => perform(deleting.id, () => deleteVideoAction(deleting.id), () => setDeleting(null))}
              >
                {pending ? "Excluindo…" : "Excluir vídeo"}
              </button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
