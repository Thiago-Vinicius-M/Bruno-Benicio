import { createSupabasePublicClient } from "@/lib/supabase/public";
import { getPublicShowModels } from "./showModelsRepository";
import type { ShowModelsState } from "./types";

/**
 * Modelos da seção NOSSO SHOW. Sem banco (não configurado ou fora do ar) a seção mostra
 * um aviso para usar os contatos — o resto do site continua no ar.
 */
export async function loadShowModels(): Promise<ShowModelsState> {
  try {
    return { status: "ready", models: await getPublicShowModels(createSupabasePublicClient()) };
  } catch (error) {
    console.error("[modelos] falha ao carregar os modelos de show do site", error);
    return { status: "error" };
  }
}
