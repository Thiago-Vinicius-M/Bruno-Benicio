import "server-only";
import type { AgendaClient } from "@/lib/supabase/client";
import { Constants } from "@/lib/supabase/database.types";
import { AgendaError, toAgendaError, unwrap, validationError } from "./errors";
import { PROFILE_COLUMNS, listProfiles, requireAdmin, setUserRole, updateProfileName } from "./profilesRepository";
import type { Profile, Role } from "./types";

/**
 * Gestão de usuários (somente ADMIN, somente servidor).
 *
 * - `caller`: cliente com a sessão de quem pediu (lib/supabase/server.ts). Toda
 *   escrita em `profiles` passa por ele, então o RLS e a auditoria valem normalmente.
 * - `admin`: cliente com secret key (lib/supabase/admin.ts). Usado APENAS para a API
 *   de administração do Auth (convite e bloqueio de login), sempre após `requireAdmin`.
 *
 * "Excluir" usuário = desativar: o perfil fica com deactivated_at/deactivated_by e o
 * login é bloqueado no Auth. O histórico (created_by/updated_by/deleted_by) é
 * preservado — o banco também impede apagar um usuário que tenha histórico.
 */
export type UserAdminClients = { caller: AgendaClient; admin: AgendaClient };

/** Mesma mensagem do banco (AG004): o próprio ADMIN não se rebaixa nem se desativa. */
export const SELF_REMOVAL_MESSAGE = "Você não pode remover o próprio acesso administrativo.";
const selfRemoval = () => new AgendaError("CONFLICT", SELF_REMOVAL_MESSAGE);

const BAN_FOREVER = "876000h"; // ~100 anos: bloqueio indefinido até reativação

export type InviteUserInput = { email: string; name: string; role: Role; redirectTo: string };

/** Convida por e-mail (o usuário define a senha pelo link) e cria o perfil com o papel escolhido. */
export async function inviteUser({ caller, admin }: UserAdminClients, input: InviteUserInput): Promise<Profile> {
  await requireAdmin(caller);

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw validationError("E-mail inválido.");
  if (!name || name.length > 120) throw validationError("Informe um nome com até 120 caracteres.");
  if (!Constants.public.Enums.app_role.includes(input.role)) throw validationError("Papel inválido.");

  const invite = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: input.redirectTo });
  if (invite.error) throw toAgendaError(invite.error);
  const userId = invite.data.user.id;

  const created = await caller
    .from("profiles")
    .insert({ id: userId, name, role: input.role })
    .select(PROFILE_COLUMNS)
    .single();

  if (created.error) {
    // Compensação: sem perfil o usuário não teria acesso, mas não deve sobrar convite órfão.
    const rollback = await admin.auth.admin.deleteUser(userId);
    if (rollback.error) {
      throw new AgendaError(
        "UNKNOWN",
        "O convite foi enviado, mas o perfil não pôde ser criado. Remova o usuário no painel do Supabase.",
        { cause: [created.error, rollback.error] },
      );
    }
    throw toAgendaError(created.error);
  }
  return created.data;
}

/** "Exclui" (desativa) um usuário: corta o acesso aos dados (RLS) e bloqueia o login. */
export async function deactivateUser({ caller, admin }: UserAdminClients, userId: string): Promise<Profile> {
  const me = await requireAdmin(caller);
  if (me.id === userId) throw selfRemoval();

  // Primeiro o banco: a partir daqui o RLS já nega tudo, mesmo com token ainda válido.
  const profile = unwrap(
    await caller
      .from("profiles")
      .update({ deactivated_at: new Date().toISOString() }) // valor real definido pelo trigger
      .eq("id", userId)
      .select(PROFILE_COLUMNS)
      .single(),
    "Usuário não encontrado.",
  );

  const ban = await admin.auth.admin.updateUserById(userId, { ban_duration: BAN_FOREVER });
  if (ban.error) {
    throw new AgendaError(
      "UNKNOWN",
      "Usuário desativado no sistema, mas o bloqueio de login falhou. Tente novamente.",
      { cause: ban.error },
    );
  }
  return profile;
}

export async function reactivateUser({ caller, admin }: UserAdminClients, userId: string): Promise<Profile> {
  await requireAdmin(caller);

  const unban = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (unban.error) throw toAgendaError(unban.error);

  return unwrap(
    await caller.from("profiles").update({ deactivated_at: null }).eq("id", userId).select(PROFILE_COLUMNS).single(),
    "Usuário não encontrado.",
  );
}

/** Altera o papel. O banco também barra rebaixar o último ADMIN (AG003) e a si mesmo (AG004). */
export async function changeUserRole({ caller }: Pick<UserAdminClients, "caller">, userId: string, role: Role): Promise<Profile> {
  const me = await requireAdmin(caller);
  if (!Constants.public.Enums.app_role.includes(role)) throw validationError("Papel inválido.");
  if (me.id === userId && role !== "ADMIN") throw selfRemoval();
  return setUserRole(caller, userId, role);
}

export async function renameUser({ caller }: Pick<UserAdminClients, "caller">, userId: string, name: string): Promise<Profile> {
  await requireAdmin(caller);
  return updateProfileName(caller, userId, name);
}

/**
 * Usuário do painel como o ADMIN o enxerga: perfil (papel, status, auditoria) + o
 * mínimo do Auth (e-mail, convite pendente, último acesso). Nada de tokens, senha,
 * metadados ou identidades.
 */
export type TeamMember = {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  email: string | null;
  invitePending: boolean;
  lastSignInAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  deactivatedAt: string | null;
  deactivatedBy: string | null;
};

export type ListUsersOptions = { page?: number; perPage?: number };

/** Ativos primeiro; dentro de cada grupo, por nome. */
export const compareMembers = (a: TeamMember, b: TeamMember) =>
  Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

export async function listUsers(
  { caller, admin }: UserAdminClients,
  { page = 1, perPage = 1000 }: ListUsersOptions = {},
): Promise<TeamMember[]> {
  await requireAdmin(caller);

  // Perfis pela sessão do ADMIN (RLS); a secret key só para ler e-mails do Auth.
  const [profiles, auth] = await Promise.all([listProfiles(caller), admin.auth.admin.listUsers({ page, perPage })]);
  if (auth.error) throw toAgendaError(auth.error);
  const authById = new Map(auth.data.users.map((user) => [user.id, user]));

  return profiles
    .map((profile): TeamMember => {
      const user = authById.get(profile.id);
      return {
        id: profile.id,
        name: profile.name,
        role: profile.role,
        active: profile.deactivated_at === null,
        email: user?.email ?? null,
        invitePending: Boolean(user?.invited_at && !user.email_confirmed_at),
        lastSignInAt: user?.last_sign_in_at ?? null,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        createdBy: profile.created_by,
        updatedBy: profile.updated_by,
        deactivatedAt: profile.deactivated_at,
        deactivatedBy: profile.deactivated_by,
      };
    })
    .sort(compareMembers);
}
