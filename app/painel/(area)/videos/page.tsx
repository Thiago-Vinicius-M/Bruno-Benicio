import type { Metadata } from "next";
import { Suspense } from "react";
import styles from "@/components/Painel/Painel.module.css";
import { LoadError } from "@/components/Painel/LoadError";
import { VideosLoading } from "@/components/Painel/Videos/VideosLoading";
import { VideosView } from "@/components/Painel/Videos/VideosView";
import { listTeamNames } from "@/lib/agenda/profilesRepository";
import { requirePanelUser } from "@/lib/painel/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Video, VideoHomeLimits } from "@/lib/videos/types";
import { getVideoHomeLimits, listVideos } from "@/lib/videos/videosRepository";

export const metadata: Metadata = { title: "Vídeos" };

/** Vídeos do site (ADMIN e EDITOR): principal, secundários, "Ver mais" e limites da Home. */
export default async function VideosPage() {
  await requirePanelUser();

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Vídeos</h1>
        <p className={styles.pageLead}>
          A Home mostra o vídeo principal e os secundários, até o limite de cada tela; o restante vai para o “Ver
          mais”. A grade se monta sozinha a partir da ordem e do formato de cada vídeo.
        </p>
      </header>

      <Suspense fallback={<VideosLoading />}>
        <VideosData />
      </Suspense>
    </>
  );
}

async function VideosData() {
  const client = await createSupabaseServerClient();

  let videos: Video[] | null = null;
  let limits: VideoHomeLimits | null = null;
  try {
    [videos, limits] = await Promise.all([listVideos(client), getVideoHomeLimits(client)]);
  } catch (error) {
    console.error("[videos] falha ao carregar", error);
  }
  if (!videos || !limits) return <LoadError message="Não foi possível carregar os vídeos." />;

  // Nomes para a auditoria (adicionado/alterado por). Sem eles a lista ainda funciona.
  const authors = await listTeamNames(client).catch(() => ({}));

  return <VideosView videos={videos} limits={limits} authors={authors} />;
}
