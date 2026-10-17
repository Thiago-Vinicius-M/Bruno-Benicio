import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadError } from "@/components/Painel/LoadError";
import styles from "@/components/Painel/Painel.module.css";
import { ShowModelsLoading } from "@/components/Painel/ShowModels/ShowModelsLoading";
import { ShowModelsView } from "@/components/Painel/ShowModels/ShowModelsView";
import { listTeamNames } from "@/lib/agenda/profilesRepository";
import { requirePanelAdmin } from "@/lib/painel/session";
import { listShowModels } from "@/lib/showModels/showModelsRepository";
import type { ShowModel } from "@/lib/showModels/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Modelos de Show" };

/** Formatos e preços da seção NOSSO SHOW. Exclusiva de ADMIN. */
export default async function ShowModelsPage() {
  await requirePanelAdmin();

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Modelos de Show</h1>
      </header>

      <Suspense fallback={<ShowModelsLoading />}>
        <ShowModelsData />
      </Suspense>
    </>
  );
}

async function ShowModelsData() {
  const client = await createSupabaseServerClient();

  let models: ShowModel[] | null = null;
  try {
    models = await listShowModels(client);
  } catch (error) {
    console.error("[modelos] falha ao carregar", error);
  }
  if (!models) return <LoadError message="Não foi possível carregar os modelos de show." />;

  // Nomes para a auditoria (adicionado/alterado por). Sem eles a lista ainda funciona.
  const authors = await listTeamNames(client).catch(() => ({}));

  return <ShowModelsView models={models} authors={authors} />;
}
