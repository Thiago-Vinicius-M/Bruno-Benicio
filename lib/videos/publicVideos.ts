import { createSupabasePublicClient } from "@/lib/supabase/public";
import { DEFAULT_HOME_LIMITS, EMPTY_COLLECTION, toVideoCollection, type VideoCollection } from "./gallery";
import { getPublicVideoHomeLimits, getPublicVideos } from "./videosRepository";

/**
 * Vídeos da Home e do "Ver mais", com os limites por dispositivo. Sem banco (não
 * configurado ou fora do ar) a seção VIDEOS simplesmente não aparece — o resto do site
 * continua no ar. Sem a configuração (linha ausente ou erro), valem os limites padrão.
 */
export async function loadVideoCollection(): Promise<VideoCollection> {
  try {
    const client = createSupabasePublicClient();
    const [videos, limits] = await Promise.all([
      getPublicVideos(client),
      // Falha só nos limites não derruba a seção: valem os padrões.
      getPublicVideoHomeLimits(client).catch((error) => {
        console.error("[videos] falha ao carregar os limites da Home; usando os padrões", error);
        return null;
      }),
    ]);
    return toVideoCollection(videos, limits ?? DEFAULT_HOME_LIMITS);
  } catch (error) {
    console.error("[videos] falha ao carregar os vídeos do site", error);
    return EMPTY_COLLECTION;
  }
}
