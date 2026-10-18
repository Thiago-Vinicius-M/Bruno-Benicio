import type { Metadata } from "next";
import { Suspense } from "react";
import { CommercialLinksLoading } from "@/components/Painel/CommercialLinks/CommercialLinksLoading";
import { CommercialLinksView } from "@/components/Painel/CommercialLinks/CommercialLinksView";
import { LoadError } from "@/components/Painel/LoadError";
import styles from "@/components/Painel/Painel.module.css";
import { listChannels } from "@/lib/commercialLinks/channelsRepository";
import { getLinkPermissions, listCommercialLinks, listLinkModels } from "@/lib/commercialLinks/linksRepository";
import type { PanelUser } from "@/lib/painel/access";
import { publicSiteOrigin } from "@/lib/painel/authCallback";
import { requirePanelLinkCreator } from "@/lib/painel/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Links comerciais" };

/** Links comerciais (ADMIN e SELLER). Os WhatsApp são cadastrados em Configurações (ADMIN). */
export default async function CommercialLinksPage() {
  const user = await requirePanelLinkCreator();

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Links comerciais</h1>
      </header>

      <Suspense fallback={<CommercialLinksLoading />}>
        <CommercialLinksData user={user} />
      </Suspense>
    </>
  );
}

async function CommercialLinksData({ user }: { user: PanelUser }) {
  const client = await createSupabaseServerClient();

  let data: [
    Awaited<ReturnType<typeof listCommercialLinks>>,
    Awaited<ReturnType<typeof listChannels>>,
    Awaited<ReturnType<typeof listLinkModels>>,
    Awaited<ReturnType<typeof getLinkPermissions>>,
  ] | null = null;
  try {
    data = await Promise.all([listCommercialLinks(client), listChannels(client), listLinkModels(client), getLinkPermissions(client)]);
  } catch (error) {
    console.error("[links comerciais] falha ao carregar", error);
  }
  if (!data) return <LoadError message="Não foi possível carregar os links comerciais." />;
  const [links, channels, models, permissions] = data;

  return (
    <CommercialLinksView
      user={user}
      permissions={permissions}
      links={links}
      channels={channels}
      models={models}
      siteOrigin={await publicSiteOrigin()}
    />
  );
}
