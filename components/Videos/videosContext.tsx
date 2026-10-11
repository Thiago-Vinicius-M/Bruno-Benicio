"use client";

import { createContext, useContext, type ReactNode } from "react";
import { EMPTY_COLLECTION, type VideoCollection } from "@/lib/videos/gallery";

/**
 * Vídeos cadastrados no painel, carregados no servidor (app/page.tsx) e compartilhados
 * pela seção VIDEOS (destaques) e pela subtela do "Ver mais" (galeria).
 */
const VideosContext = createContext<VideoCollection>(EMPTY_COLLECTION);

export const useVideoCollection = () => useContext(VideosContext);

export function VideosProvider({ videos, children }: { videos: VideoCollection; children: ReactNode }) {
  return <VideosContext value={videos}>{children}</VideosContext>;
}
