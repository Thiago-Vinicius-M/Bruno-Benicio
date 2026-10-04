import type { Metadata } from "next";
import { AuthCard } from "@/components/Painel/AuthCard";
import { ConfirmLink } from "@/components/Painel/ConfirmLink";
import { PANEL_ROUTES, safePanelPath } from "@/lib/painel/routes";

export const metadata: Metadata = { title: "Confirmar acesso" };

/** Destino de links do Auth com a sessão no fragmento (ex.: convite no template padrão). */
export default async function ConfirmLinkPage({ searchParams }: PageProps<"/painel/confirmar">) {
  const { next } = await searchParams;
  const target = safePanelPath(typeof next === "string" ? next : null, PANEL_ROUTES.home);

  return (
    <AuthCard title="Confirmar acesso">
      <ConfirmLink next={target} />
    </AuthCard>
  );
}
