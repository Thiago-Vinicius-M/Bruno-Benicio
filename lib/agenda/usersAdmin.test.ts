import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "./testing/fakeSupabase";
import { changeUserRole, deactivateUser, inviteUser, listUsers, reactivateUser, renameUser } from "./usersAdmin";

const adminProfile = { id: "admin-id", name: "Bruno", role: "ADMIN", deactivated_at: null };
const editorProfile = { id: "editor-id", name: "Benicio", role: "EDITOR", deactivated_at: null };

function setup(callerProfile: object, extraResponses: { data: unknown; error: unknown }[] = []) {
  const caller = createFakeSupabase([{ data: callerProfile, error: null }, ...extraResponses]);
  caller.auth.getUser.mockResolvedValue({ data: { user: { id: (callerProfile as { id: string }).id } }, error: null });
  const admin = createFakeSupabase();
  return { caller, admin, clients: { caller: caller.client, admin: admin.client } };
}

const invite = { email: "Novo@Example.com", name: "Novo", role: "EDITOR" as const, redirectTo: "https://site/auth/convite" };

describe("usersAdmin", () => {
  it("EDITOR não consegue criar usuário: a API admin do Auth nem é chamada", async () => {
    const { admin, clients } = setup(editorProfile);
    await expect(inviteUser(clients, invite)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(admin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("ADMIN convida pelo Supabase Auth e cria o perfil com a sessão dele (sem senha na aplicação)", async () => {
    const { caller, admin, clients } = setup(adminProfile, [{ data: { id: "new-id", role: "EDITOR" }, error: null }]);
    admin.auth.admin.inviteUserByEmail.mockResolvedValue({ data: { user: { id: "new-id" } }, error: null });

    await inviteUser(clients, invite);

    expect(admin.auth.admin.inviteUserByEmail).toHaveBeenCalledWith("novo@example.com", {
      redirectTo: "https://site/auth/convite",
    });
    const inserts = caller.calls.filter(([m]) => m === "insert");
    expect(inserts).toEqual([["insert", { id: "new-id", name: "Novo", role: "EDITOR" }]]);
    expect(admin.calls).toEqual([]); // secret key não toca nas tabelas
  });

  it("se o perfil falhar, o convite é desfeito e o erro é propagado", async () => {
    const { admin, clients } = setup(adminProfile, [{ data: null, error: { code: "42501", message: "rls" } }]);
    admin.auth.admin.inviteUserByEmail.mockResolvedValue({ data: { user: { id: "new-id" } }, error: null });
    admin.auth.admin.deleteUser.mockResolvedValue({ data: {}, error: null });

    await expect(inviteUser(clients, invite)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith("new-id");
  });

  it("desativar: primeiro o perfil (RLS), depois o bloqueio de login no Auth", async () => {
    const { caller, admin, clients } = setup(adminProfile, [{ data: { id: "editor-id" }, error: null }]);
    admin.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null });

    await deactivateUser(clients, "editor-id");

    expect(caller.calls.filter(([m]) => m === "update")).toHaveLength(1);
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith("editor-id", { ban_duration: "876000h" });
  });

  it("ADMIN não pode desativar a si mesmo; EDITOR não pode desativar ninguém", async () => {
    await expect(deactivateUser(setup(adminProfile).clients, "admin-id")).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Você não pode remover o próprio acesso administrativo.",
    });

    const { admin, clients } = setup(editorProfile);
    await expect(deactivateUser(clients, "admin-id")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
});

type Clients = ReturnType<typeof setup>["clients"];

describe("papel, nome e reativação", () => {
  it("ADMIN promove EDITOR a ADMIN pela sessão dele", async () => {
    const { caller, clients } = setup(adminProfile, [{ data: { id: "editor-id", role: "ADMIN" }, error: null }]);
    await changeUserRole(clients, "editor-id", "ADMIN");
    expect(caller.calls.filter(([m]) => m === "update")).toEqual([["update", { role: "ADMIN" }]]);
  });

  it("ADMIN não rebaixa a si mesmo (a mensagem é a mesma do banco)", async () => {
    const { caller, clients } = setup(adminProfile);
    await expect(changeUserRole(clients, "admin-id", "EDITOR")).rejects.toMatchObject({
      message: "Você não pode remover o próprio acesso administrativo.",
    });
    expect(caller.calls.filter(([m]) => m === "update")).toEqual([]);
  });

  it("papel fora de ADMIN/EDITOR é recusado antes do banco", async () => {
    const { caller, clients } = setup(adminProfile);
    await expect(changeUserRole(clients, "editor-id", "SUPERADMIN" as never)).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect(caller.calls.filter(([m]) => m === "update")).toEqual([]);
  });

  it("EDITOR não altera papel, nome nem reativa ninguém", async () => {
    const operations = [
      (c: Clients) => changeUserRole(c, "editor-id", "ADMIN"),
      (c: Clients) => renameUser(c, "admin-id", "Outro"),
      (c: Clients) => reactivateUser(c, "admin-id"),
    ];
    for (const run of operations) {
      const { caller, admin, clients } = setup(editorProfile);
      await expect(run(clients)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(caller.calls.filter(([m]) => m === "update")).toEqual([]);
      expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
    }
  });

  it("reativar: desbloqueia o login e limpa a desativação do perfil", async () => {
    const { caller, admin, clients } = setup(adminProfile, [{ data: { id: "editor-id" }, error: null }]);
    admin.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null });
    await reactivateUser(clients, "editor-id");
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith("editor-id", { ban_duration: "none" });
    expect(caller.calls.filter(([m]) => m === "update")).toEqual([["update", { deactivated_at: null }]]);
  });
});

describe("listUsers", () => {
  const profile = (id: string, name: string, extra: object = {}) => ({
    id,
    name,
    role: "EDITOR",
    deactivated_at: null,
    deactivated_by: null,
    created_by: "admin-id",
    updated_by: "admin-id",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...extra,
  });

  it("EDITOR não lista usuários: nem perfis alheios nem a API admin do Auth", async () => {
    const { admin, caller, clients } = setup(editorProfile);
    await expect(listUsers(clients)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
    // Só a leitura do próprio perfil (autorização); a listagem nem começa.
    expect(caller.calls.filter(([m]) => m === "from")).toHaveLength(1);
  });

  it("ADMIN: perfil + e-mail, ativos primeiro e por nome, sem dados sensíveis do Auth", async () => {
    const { admin, clients } = setup(adminProfile, [
      {
        data: [
          profile("u-zeca", "Zeca"),
          profile("u-ana", "Ana", { deactivated_at: "2026-09-10T00:00:00Z", deactivated_by: "admin-id" }),
          profile("u-bia", "Bia", { role: "ADMIN" }),
        ],
        error: null,
      },
    ]);
    admin.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: "u-zeca",
            email: "zeca@example.com",
            invited_at: "2026-09-01",
            email_confirmed_at: null,
            last_sign_in_at: null,
            app_metadata: { provider: "email" },
          },
          { id: "u-ana", email: "ana@example.com", email_confirmed_at: "2026-09-01", last_sign_in_at: "2026-09-05T10:00:00Z" },
          {
            id: "u-bia",
            email: "bia@example.com",
            invited_at: "2026-09-01",
            email_confirmed_at: "2026-09-02",
            last_sign_in_at: "2026-09-02T00:00:00Z",
          },
        ],
      },
      error: null,
    });

    const members = await listUsers(clients);

    expect(admin.auth.admin.listUsers).toHaveBeenCalledWith({ page: 1, perPage: 1000 });
    expect(members.map((m) => [m.name, m.active])).toEqual([
      ["Bia", true],
      ["Zeca", true],
      ["Ana", false],
    ]);
    expect(members.find((m) => m.name === "Zeca")).toMatchObject({ email: "zeca@example.com", invitePending: true });
    expect(members.find((m) => m.name === "Bia")?.invitePending).toBe(false);
    expect(Object.keys(members[0]).sort()).toEqual(
      [
        "active",
        "createdAt",
        "createdBy",
        "deactivatedAt",
        "deactivatedBy",
        "email",
        "id",
        "invitePending",
        "lastSignInAt",
        "name",
        "role",
        "updatedAt",
        "updatedBy",
      ].sort(),
    );
    expect(JSON.stringify(members)).not.toMatch(/provider|token|password/i);
  });
});
