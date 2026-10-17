import type { Role } from "@/lib/agenda/types";
import { LINK_CREATOR_ROLES, STAFF_ROLES } from "@/lib/painel/access";
import { PANEL_ROUTES } from "@/lib/painel/routes";

export type PanelNavItem = {
  label: string;
  /** Sem `href`: funcionalidade ainda não disponível (exibida como "Em breve"). */
  href?: string;
  /** Visível só para esses papéis. Esconder o item é conveniência; a barreira real é o RLS. */
  roles?: readonly Role[];
};

const NAV_ITEMS: PanelNavItem[] = [
  { label: "Início", href: PANEL_ROUTES.home },
  { label: "Agenda", href: PANEL_ROUTES.agenda, roles: STAFF_ROLES },
  { label: "Vídeos", href: PANEL_ROUTES.videos, roles: STAFF_ROLES },
  // Preços padrão: só ADMIN.
  { label: "Modelos de Show", href: PANEL_ROUTES.showModels, roles: ["ADMIN"] },
  { label: "Links comerciais", href: PANEL_ROUTES.commercialLinks, roles: LINK_CREATOR_ROLES },
  { label: "Configurações", href: PANEL_ROUTES.changePassword },
];

export const panelNavFor = (role: Role) => NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

/** Item ativo: igualdade exata para o Início; prefixo para as demais seções. */
export function isActiveNavItem(item: PanelNavItem, pathname: string): boolean {
  if (!item.href) return false;
  if (item.href === PANEL_ROUTES.home) return pathname === PANEL_ROUTES.home;
  const section = item.href.split("/").slice(0, 3).join("/");
  return pathname === section || pathname.startsWith(`${section}/`);
}
