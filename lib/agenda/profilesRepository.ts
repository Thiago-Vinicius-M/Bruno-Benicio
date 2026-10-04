import type { AgendaClient } from "@/lib/supabase/client";
import { Constants } from "@/lib/supabase/database.types";
import { getSessionUser } from "./authService";
import { AgendaError, toAgendaError, unwrap, validationError } from "./errors";
import type { Profile, Role } from "./types";

export const PROFILE_COLUMNS =
  "id, name, role, deactivated_at, deactivated_by, created_by, updated_by, created_at, updated_at";

/**
 * Perfil do usuário logado, ou `null` se não houver sessão. Um usuário do Auth sem
 * perfil (ex.: cadastro não convidado) também resulta em `null` — sem acesso.
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

/**
 * Perfis completos da equipe. Pelo RLS, só ADMIN recebe todos; os demais recebem apenas
 * o próprio. Para exibir autoria, use `listTeamNames`.
 */
export async function listProfiles(client: AgendaClient): Promise<Profile[]> {
  const { data, error } = await client.from("profiles").select(PROFILE_COLUMNS).order("name");
  if (error) throw toAgendaError(error);
  return data;
}

/** Nomes da equipe por id (qualquer staff ativo), para "criado/excluído por" no painel. */
export async function listTeamNames(client: AgendaClient): Promise<Record<string, string>> {
  const { data, error } = await client.rpc("get_team_names");
  if (error) throw toAgendaError(error);
  return Object.fromEntries(data.map((member) => [member.id, member.name]));
}

export async function updateProfileName(client: AgendaClient, id: string, name: string): Promise<Profile> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 120) throw validationError("Informe um nome com até 120 caracteres.");
  return unwrap(
    await client.from("profiles").update({ name: trimmed }).eq("id", id).select(PROFILE_COLUMNS).single(),
    "Usuário não encontrado.",
  );
}

/** Somente ADMIN (garantido pelo trigger/RLS). O banco impede remover o último ADMIN. */
export async function setUserRole(client: AgendaClient, id: string, role: Role): Promise<Profile> {
  if (!Constants.public.Enums.app_role.includes(role)) throw validationError("Papel inválido.");
  return unwrap(
    await client.from("profiles").update({ role }).eq("id", id).select(PROFILE_COLUMNS).single(),
    "Usuário não encontrado.",
  );
}
