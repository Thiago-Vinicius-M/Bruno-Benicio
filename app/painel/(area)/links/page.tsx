import type { Metadata } from "next";
import { Suspense } from "react";
import { CommercialLinksLoading } from "@/components/Painel/CommercialLinks/CommercialLinksLoading";
import { CommercialLinksView } from "@/components/Painel/CommercialLinks/CommercialLinksView";
import { LoadError } from "@/components/Painel/LoadError";
import styles from "@/components/Painel/Painel.module.css";
import { listChannelOwners, listChannels } from "@/lib/commercialLinks/channelsRepository";
import { getLinkPermissions, listCommercialLinks, listLinkModels } from "@/lib/commercialLinks/linksRepository";
import type { PanelUser } from "@/lib/painel/access";
import { publicSiteOrigin } from "@/lib/painel/authCallback";
import { requirePanelLinkCreator } from "@/lib/painel/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Links comerciais" };

/** Links comerciais (ADMIN e SELLER). ADMIN também administra os canais de WhatsApp. */
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
  const isAdmin = user.role === "ADMIN";

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

  // Só ADMIN: donos possíveis dos canais. Sem eles, os links ainda funcionam.
  const owners = isAdmin ? await listChannelOwners(client).catch(() => []) : [];

  return (
    <CommercialLinksView
      user={user}
      permissions={permissions}
      links={links}
      // O vendedor recebe só os próprios canais (RLS); o ADMIN, todos, para administrar.
      channels={channels}
      models={models}
      owners={owners}
      siteOrigin={await publicSiteOrigin()}
    />
  );
}
