import { VideoGallery } from "@/components/VideoGallery/VideoGallery";
import { VIDEOS } from "./videoList";

/**
 * Subtela VIDEOS: a galeria completa — a mesma VideoGallery da Home, sem `highlights`
 * (no celular a Home mostra só os destaques; aqui aparecem todos, na composição normal).
 */
export function VideosExperience() {
  return (
    <div data-experience-item>
      <VideoGallery videos={VIDEOS} />
    </div>
  );
}
