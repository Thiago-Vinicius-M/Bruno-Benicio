import type { StaticImageData } from "next/image";
import type { GalleryVideo } from "@/components/VideoGallery/types";

/**
 * Vídeos da seção VIDEOS.
 *
 * HORIZONTAIS → link do YouTube (toca no próprio site, player do YouTube)
 *   horizontal({ id: "foi-deus", title: "Foi Deus", youtube: "https://youtu.be/XXXXXXXXXXX" })
 *   Aceita qualquer link do YouTube (watch?v=, youtu.be, shorts, embed) ou só o ID.
 *   A thumbnail vem do próprio YouTube; para usar outra, informe `thumbnail`.
 *
 * VERTICAIS → arquivo .mp4 na pasta public/videos/
 *   vertical({ id: "bastidores", title: "Bastidores", file: "bastidores.mp4", poster: "bastidores.jpg" })
 *   `file` e `poster` são só o nome do arquivo dentro de public/videos/ (igual ao nome
 *   na pasta, com maiúsculas, espaços e acentos).
 *   Sem poster, o card mostra o primeiro quadro do vídeo.
 *
 * Sem `youtube`/`file` o card fica como placeholder ("Vídeo em breve").
 *
 * ORDEM
 *   A galeria monta as linhas sozinha: horizontal · horizontal, depois vertical ·
 *   (horizontal / horizontal) · vertical, e repete. Horizontais ocupam as posições
 *   horizontais na ordem desta lista, e verticais, as verticais.
 *   Composição completa: 4 horizontais + 2 verticais por ciclo.
 *   `id` precisa ser único (letras minúsculas e hífens).
 */
export const VIDEOS: GalleryVideo[] = [
  horizontal({ id: "horizontal-01", title: "Foi Deus (AO VIVO)", youtube: "https://www.youtube.com/watch?v=TDqHMUM0Z4k" }),
  horizontal({ id: "horizontal-02", title: "SÓ PRO MEU PRAZER (AO VIVO)", youtube: "https://www.youtube.com/watch?v=wIpRwHLWECw" }),
  vertical({ id: "palavrasAoVento", title: "Palavras Ao Vento", file: "Palavras Ao Vento.mp4", poster:"Palavras Ao Vento Thumb.jpg" }),
  horizontal({ id: "horizontal-03", title: "POT-POURRI MANEIRA ERRADA / QUEM DE NOS DOIS", youtube: "https://www.youtube.com/watch?v=b-5AnnoJeg4" }),
  horizontal({ id: "horizontal-04", title: "AMIGO", youtube: "https://www.youtube.com/watch?v=pbfAmBaOKCk" }),
  vertical({ id: "soDaVoceNaMinhaVida", title: "Só da você na minha vida", file: "So Da Você Na Minha Vida.mp4", poster: "So Da Você Na Minha Vida Thumb.jpg" }),
];

type Common = {
  id: string;
  title: string;
  category?: string;
};

/** Vídeo horizontal (16:9) do YouTube. */
function horizontal({ youtube, thumbnail, ...rest }: Common & { youtube?: string; thumbnail?: StaticImageData | string }): GalleryVideo {
  return { ...rest, type: "video", sourceType: "youtube", orientation: "landscape", source: youtube, thumbnail };
}

/** Vídeo vertical (9:16) em arquivo .mp4 dentro de public/videos/. */
function vertical({ file, poster, ...rest }: Common & { file?: string; poster?: string }): GalleryVideo {
  return {
    ...rest,
    type: "video",
    sourceType: "local",
    orientation: "portrait",
    source: publicVideo(file),
    thumbnail: publicVideo(poster),
  };
}

/** Caminho de um arquivo de public/videos/ (espaços e acentos no nome viram %20, %C3%AA...). */
function publicVideo(fileName?: string) {
  return fileName ? `/videos/${encodeURIComponent(fileName)}` : undefined;
}
