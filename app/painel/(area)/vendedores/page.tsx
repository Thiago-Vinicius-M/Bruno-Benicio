import { redirect } from "next/navigation";
import { PANEL_ROUTES } from "@/lib/painel/routes";

/** Endereço antigo da seção Vendedores (favoritos, histórico): agora é Links comerciais. */
export default function LegacySellersPage() {
  redirect(PANEL_ROUTES.commercialLinks);
}
