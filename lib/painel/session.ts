import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolvePanelAccess, type PanelUser } from "./access";
import { PANEL_ROUTES } from "./routes";

/**
 * Camada de acesso do painel no servidor. O proxy só faz a checagem otimista (há
 * sessão?); aqui a sessão é validada no Auth e o perfil é lido do banco.
 * `cache` evita repetir as consultas quando layout e página pedem o mesmo dado.
 */
export const getPanelAccess = cache(async () => resolvePanelAccess(await createSupabaseServerClient()));

/**
 * Exigido por toda página e Server Action protegida (layouts não re-renderizam na
 * navegação, então não bastam sozinhos). Sem sessão → login; sem perfil ativo →
 * acesso negado (nunca de volta ao login, o que criaria um loop com o proxy).
 */
export async function requirePanelUser(): Promise<PanelUser> {
  const access = await getPanelAccess();
  if (access.status === "anonymous") redirect(PANEL_ROUTES.login);
  if (access.status === "denied") redirect(PANEL_ROUTES.accessDenied);
  return access.user;
}

/**
 * Autorização central das áreas exclusivas de ADMIN (páginas e Server Actions): sessão
 * validada no Auth + perfil ativo lido do banco + papel ADMIN. Nada vem do navegador.
 * EDITOR é mandado para "acesso negado"; as operações nem começam. É a camada de
 * aplicação: `requireAdmin` (repositório) e o RLS/trigger do banco repetem a checagem.
 */
export async function requirePanelAdmin(): Promise<PanelUser> {
  const user = await requirePanelUser();
  if (user.role !== "ADMIN") redirect(`${PANEL_ROUTES.accessDenied}?motivo=admin`);
  return user;
}
