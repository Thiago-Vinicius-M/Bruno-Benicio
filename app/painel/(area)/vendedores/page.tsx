import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadError } from "@/components/Painel/LoadError";
import styles from "@/components/Painel/Painel.module.css";
import { SellersLoading } from "@/components/Painel/Sellers/SellersLoading";
import { SellersView } from "@/components/Painel/Sellers/SellersView";
import { publicSiteOrigin } from "@/lib/painel/authCallback";
import { requirePanelAdmin } from "@/lib/painel/session";
import { listSellers } from "@/lib/sellers/sellersRepository";
import type { Seller } from "@/lib/sellers/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Vendedores" };

/** Vendedores e links comerciais. Exclusiva de ADMIN. */
export default async function SellersPage() {
  await requirePanelAdmin();

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Vendedores</h1>
        <p className={styles.pageLead}>
          Cada vendedor tem um link próprio. Quem abre o link e escolhe um formato em “Nosso show” volta ao WhatsApp
          deste vendedor. Vendedores não acessam o painel.
        </p>
      </header>

      <Suspense fallback={<SellersLoading />}>
        <SellersData />
      </Suspense>
    </>
  );
}

async function SellersData() {
  let sellers: Seller[] | null = null;
  try {
    sellers = await listSellers(await createSupabaseServerClient());
  } catch (error) {
    console.error("[vendedores] falha ao carregar", error);
  }
  if (!sellers) return <LoadError message="Não foi possível carregar os vendedores." />;
  return <SellersView sellers={sellers} siteOrigin={await publicSiteOrigin()} />;
}
