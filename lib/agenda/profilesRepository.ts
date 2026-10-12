import type { AgendaClient } from "@/lib/supabase/client";
import { getSessionUser } from "./authService";
import { AgendaError, toAgendaError } from "./errors";
import type { Profile, Role } from "./types";

export const PROFILE_COLUMNS =
  "id, name, role, deactivated_at, deactivated_by, created_by, updated_by, created_at, updated_at";

/**
 * Perfil do usuário logado, ou `null` se não houver sessão. Um usuário do Auth sem
 * perfil (ex.: cadastro aberto por engano) também resulta em `null` — sem acesso.
 */
export async function getCurrentProfile(client: AgendaClient): Promise<Profile | null> {
  const user = await getSessionUser(client);
  if (!user) return null;
  return getProfileByUserId(client, user.id);
}

/** Perfil de um usuário (sujeito ao RLS: sem perfil ativo, nada é visível). */
export async function getProfileByUserId(client: AgendaClient, userId: string): Promise<Profile | null> {
  const result = await client.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
  if (result.error) throw toAgendaError(result.error);
  return result.data;
}

/**
 * Garante usuário logado, com perfil ativo e (opcionalmente) papel exigido.
 * É uma checagem de aplicação (para mensagens e fluxo); a barreira real é o RLS.
 */
export async function requireProfile(client: AgendaClient, role?: Role): Promise<Profile> {
  const profile = await getCurrentProfile(client);
  if (!profile) throw new AgendaError("UNAUTHENTICATED", "Entre para continuar.");
  if (profile.deactivated_at) throw new AgendaError("FORBIDDEN", "Este usuário está desativado.");
  if (role && profile.role !== role) throw new AgendaError("FORBIDDEN", "Você não tem permissão para esta operação.");
  return profile;
}

export const requireAdmin = (client: AgendaClient) => requireProfile(client, "ADMIN");

/** Nomes da equipe por id (qualquer staff ativo), para "criado/excluído por" no painel. */
export async function listTeamNames(client: AgendaClient): Promise<Record<string, string>> {
  const { data, error } = await client.rpc("get_team_names");
  if (error) throw toAgendaError(error);
  return Object.fromEntries(data.map((member) => [member.id, member.name]));
}
