"use client";

import { VideoGallery } from "@/components/VideoGallery/VideoGallery";
import { splitHomeVideos } from "@/lib/videos/gallery";
import { useIsMobileLayout } from "./useIsMobileLayout";
import { useVideoCollection } from "./videosContext";

/**
 * Subtela VIDEOS ("Ver mais"): todos os vídeos ativos que não estão na Home do layout
 * atual (o que passou do limite do dispositivo, depois os "só no Ver mais"), na ordem
 * definida no painel. A composição das linhas é a mesma da Home (galleryLayout.ts).
 */
export function VideosExperience() {
  const collection = useVideoCollection();
  const mobile = useIsMobileLayout();
  const { more } = splitHomeVideos(collection, mobile ? collection.limits.mobile : collection.limits.desktop);
  return (
    <div data-experience-item>
      <VideoGallery videos={more} />
    </div>
  );
}
