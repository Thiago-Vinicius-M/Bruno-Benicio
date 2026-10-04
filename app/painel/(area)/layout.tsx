import type { ReactNode } from "react";
import { PanelShell } from "@/components/Painel/PanelShell";
import { requirePanelUser } from "@/lib/painel/session";

/**
 * Área autenticada do painel. O layout busca o usuário para o topo, mas cada página
 * também chama `requirePanelUser` (layouts não re-renderizam ao navegar).
 */
export default async function PainelAreaLayout({ children }: { children: ReactNode }) {
  const user = await requirePanelUser();
  return <PanelShell user={user}>{children}</PanelShell>;
}
