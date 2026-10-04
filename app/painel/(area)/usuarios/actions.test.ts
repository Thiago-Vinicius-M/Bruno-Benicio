import { AuthSessionMissingError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/agenda/testing/fakeSupabase";

/**
 * Server Actions de usuários chamadas "diretamente" (como faria um EDITOR com uma
 * requisição manual): a autorização acontece no servidor, antes de qualquer acesso
 * ao banco ou à API admin do Auth. RLS/trigger: supabase/tests/agenda.db.test.ts.
 */
const state = vi.hoisted(() => ({
  caller: null as unknown as ReturnType<typeof createFakeSupabase>,
  admin: null as unknown as ReturnType<typeof createFakeSupabase>,
  adminClientsCreated: 0,
  revalidated: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => state.caller.client }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => {
    state.adminClientsCreated++;
    return state.admin.client;
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "site.test", "x-forwarded-proto": "https", origin: "https://site.test" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => state.revalidated.push(path) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const actions = await import("./actions");

const ME = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const invite = { name: "João", email: "joao@example.com", role: "EDITOR" };

/** Respostas do banco em ordem: perfil (requirePanelAdmin), perfil (requireAdmin), operação. */
function session(profile: object | null, rest: { data: unknown; error: unknown }[] = []) {
  state.caller = createFakeSupabase(profile ? [{ data: profile, error: null }, { data: profile, error: null }, ...rest] : []);
  state.caller.auth.getUser.mockResolvedValue(
    profile
      ? { data: { user: { id: ME } }, error: null }
      : { data: { user: null }, error: new AuthSessionMissingError() },
  );
  state.admin = createFakeSupabase();
  state.admin.auth.admin.inviteUserByEmail.mockResolvedValue({ data: { user: { id: OTHER } }, error: null });
  state.admin.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null });
}

const editor = { id: ME, name: "Editor", role: "EDITOR", deactivated_at: null };
const admin = { id: ME, name: "Admin", role: "ADMIN", deactivated_at: null };

const operations = [
  ["convidar", () => actions.inviteUserAction(invite)],
  ["renomear", () => actions.renameUserAction(OTHER, "Novo nome")],
  ["alterar papel (EDITOR → ADMIN)", () => actions.changeUserRoleAction(OTHER, "ADMIN")],
  ["alterar o próprio papel", () => actions.changeUserRoleAction(ME, "ADMIN")],
  ["desativar", () => actions.deactivateUserAction(OTHER)],
  ["reativar", () => actions.reactivateUserAction(OTHER)],
] as const;

const writes = () => state.caller.calls.filter(([m]) => m === "insert" || m === "update");
const authAdminCalls = () =>
  Object.values(state.admin.auth.admin).reduce((total, fn) => total + (fn as ReturnType<typeof vi.fn>).mock.calls.length, 0);

beforeEach(() => {
  state.adminClientsCreated = 0;
  state.revalidated = [];
});

describe("visitante", () => {
  it.each(operations)("não consegue %s: vai para o login", async (_, run) => {
    session(null);
    await expect(run()).rejects.toThrow("REDIRECT /painel/login");
    expect(state.caller.calls).toEqual([]);
    expect(state.adminClientsCreated).toBe(0);
  });
});

describe("EDITOR", () => {
  it.each(operations)("não consegue %s: acesso negado antes do banco e da secret key", async (_, run) => {
    session(editor);
    await expect(run()).rejects.toThrow("REDIRECT /painel/acesso-negado?motivo=admin");
    expect(writes()).toEqual([]);
    expect(state.adminClientsCreated).toBe(0);
    expect(authAdminCalls()).toBe(0);
    expect(state.revalidated).toEqual([]);
  });
});

describe("usuário desativado (mesmo ADMIN)", () => {
  it.each(operations)("não consegue %s", async (_, run) => {
    session({ ...admin, deactivated_at: "2026-09-10T00:00:00Z" });
    await expect(run()).rejects.toThrow("REDIRECT /painel/acesso-negado");
    expect(writes()).toEqual([]);
    expect(state.adminClientsCreated).toBe(0);
  });
});

describe("ADMIN", () => {
  const ok = { data: { id: OTHER }, error: null };

  it("convida pelo Supabase Auth com redirect para a definição de senha", async () => {
    session(admin, [ok]);
    await expect(actions.inviteUserAction(invite)).resolves.toEqual({
      status: "success",
      message: "Usuário convidado com sucesso.",
    });
    expect(state.admin.auth.admin.inviteUserByEmail).toHaveBeenCalledWith("joao@example.com", {
      redirectTo: "https://site.test/auth/confirm?next=%2Fpainel%2Fconfiguracoes%2Fsenha%3Fconvite%3D1",
    });
    expect(state.revalidated).toEqual(["/painel/usuarios"]);
  });

  it.each([
    ["renomear", () => actions.renameUserAction(OTHER, "Novo nome"), "Usuário atualizado com sucesso."],
    ["promover", () => actions.changeUserRoleAction(OTHER, "ADMIN"), "Perfil atualizado com sucesso."],
    ["rebaixar outro ADMIN", () => actions.changeUserRoleAction(OTHER, "EDITOR"), "Perfil atualizado com sucesso."],
    ["desativar", () => actions.deactivateUserAction(OTHER), "Usuário desativado."],
    ["reativar", () => actions.reactivateUserAction(OTHER), "Usuário reativado."],
  ] as const)("consegue %s", async (_, run, message) => {
    session(admin, [ok]);
    await expect(run()).resolves.toEqual({ status: "success", message });
    expect(state.revalidated).toEqual(["/painel/usuarios"]);
  });

  it.each([
    ["rebaixar a si mesmo", () => actions.changeUserRoleAction(ME, "EDITOR")],
    ["desativar a si mesmo", () => actions.deactivateUserAction(ME)],
  ] as const)("não consegue %s", async (_, run) => {
    session(admin);
    await expect(run()).resolves.toEqual({
      status: "error",
      message: "Você não pode remover o próprio acesso administrativo.",
    });
    expect(writes()).toEqual([]);
    expect(state.revalidated).toEqual([]);
  });

  it("papel inventado no payload é recusado", async () => {
    session(admin);
    await expect(actions.changeUserRoleAction(OTHER, "SUPERADMIN")).resolves.toEqual({
      status: "error",
      message: "Perfil inválido.",
    });
    expect(writes()).toEqual([]);
  });
});
