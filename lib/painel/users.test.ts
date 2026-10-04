import { AuthApiError } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/agenda/testing/fakeSupabase";
import {
  changeMemberRole,
  deactivateMember,
  inviteMember,
  parseInviteInput,
  reactivateMember,
  renameMember,
} from "./users";

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const EDITOR_ID = "00000000-0000-4000-8000-000000000002";
const adminProfile = { id: ADMIN_ID, name: "Bruno", role: "ADMIN", deactivated_at: null };

/** Sessão de ADMIN: 1ª resposta = perfil de quem chama; 2ª = a operação. */
function asAdmin(operation?: { data: unknown; error: unknown }) {
  const caller = createFakeSupabase([{ data: adminProfile, error: null }, ...(operation ? [operation] : [])]);
  caller.auth.getUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null });
  const admin = createFakeSupabase();
  return { caller, admin, clients: { caller: caller.client, admin: admin.client } };
}
type Clients = ReturnType<typeof asAdmin>["clients"];

afterEach(() => vi.restoreAllMocks());

describe("entrada do convite", () => {
  it("normaliza e descarta campos extras (id, status...)", () => {
    expect(parseInviteInput({ name: " João ", email: " Joao@Example.com ", role: "EDITOR", id: "x", active: false })).toEqual({
      name: "João",
      email: "joao@example.com",
      role: "EDITOR",
    });
  });

  it.each([
    [{ name: "", email: "a@b.co", role: "EDITOR" }, /nome/],
    [{ name: "x".repeat(121), email: "a@b.co", role: "EDITOR" }, /nome/],
    [{ name: "João", email: "não-é-email", role: "EDITOR" }, /E-mail/],
    [{ name: "João", email: "a@b.co", role: "SUPERADMIN" }, /Perfil/],
    [{ name: "João", email: "a@b.co", role: "admin" }, /Perfil/],
    [{ name: "João", email: "a@b.co" }, /Perfil/],
  ])("recusa %j", (input, message) => {
    expect(parseInviteInput(input)).toEqual({ error: expect.stringMatching(message) });
  });
});

describe("operações", () => {
  it("convite válido: Supabase Auth + perfil, voltando para a definição de senha", async () => {
    const { caller, admin, clients } = asAdmin({ data: { id: EDITOR_ID }, error: null });
    admin.auth.admin.inviteUserByEmail.mockResolvedValue({ data: { user: { id: EDITOR_ID } }, error: null });
    const redirectTo = "https://site/auth/confirm?next=%2Fpainel%2Fconfiguracoes%2Fsenha%3Fconvite%3D1";

    await expect(
      inviteMember(clients, { name: "João", email: "joao@example.com", role: "EDITOR" }, redirectTo),
    ).resolves.toEqual({ status: "success", message: "Usuário convidado com sucesso." });
    expect(admin.auth.admin.inviteUserByEmail).toHaveBeenCalledWith("joao@example.com", { redirectTo });
    expect(caller.calls.filter(([m]) => m === "insert")).toEqual([
      ["insert", { id: EDITOR_ID, name: "João", role: "EDITOR" }],
    ]);
  });

  it("convite inválido não chama o Auth", async () => {
    const { admin, clients } = asAdmin();
    await expect(
      inviteMember(clients, { name: "João", email: "x", role: "EDITOR" }, "https://site"),
    ).resolves.toMatchObject({ status: "error" });
    expect(admin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("e-mail já cadastrado vira mensagem clara", async () => {
    const { admin, clients } = asAdmin();
    admin.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError("exists", 422, "email_exists"),
    });
    await expect(
      inviteMember(clients, { name: "João", email: "joao@example.com", role: "EDITOR" }, "https://site"),
    ).resolves.toEqual({ status: "error", message: "Já existe um usuário com este e-mail." });
  });

  it("último administrador: a mensagem do banco chega ao usuário", async () => {
    const { clients } = asAdmin({
      data: null,
      error: { code: "AG003", message: "Não é possível remover o último administrador ativo." },
    });
    await expect(changeMemberRole(clients, EDITOR_ID, "EDITOR")).resolves.toEqual({
      status: "error",
      message: "Não é possível remover o último administrador ativo.",
    });
  });

  it("ADMIN não remove o próprio acesso (rebaixar ou desativar)", async () => {
    const operations = [
      (c: Clients) => changeMemberRole(c, ADMIN_ID, "EDITOR"),
      (c: Clients) => deactivateMember(c, ADMIN_ID),
    ];
    for (const run of operations) {
      const { admin, clients } = asAdmin();
      await expect(run(clients)).resolves.toEqual({
        status: "error",
        message: "Você não pode remover o próprio acesso administrativo.",
      });
      expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
    }
  });

  it("papel arbitrário e ids inválidos não chegam ao banco", async () => {
    const { caller, clients } = asAdmin();
    await expect(changeMemberRole(clients, EDITOR_ID, "OWNER")).resolves.toEqual({
      status: "error",
      message: "Perfil inválido.",
    });
    await expect(deactivateMember(clients, "1 or 1=1")).resolves.toEqual({ status: "error", message: "Usuário inválido." });
    await expect(renameMember(clients, null, "X")).resolves.toMatchObject({ status: "error" });
    expect(caller.calls).toEqual([]);
  });

  it("mensagens de sucesso", async () => {
    const ok = { data: { id: EDITOR_ID }, error: null };
    const role = asAdmin(ok);
    await expect(changeMemberRole(role.clients, EDITOR_ID, "ADMIN")).resolves.toEqual({
      status: "success",
      message: "Perfil atualizado com sucesso.",
    });

    const off = asAdmin(ok);
    off.admin.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null });
    await expect(deactivateMember(off.clients, EDITOR_ID)).resolves.toEqual({
      status: "success",
      message: "Usuário desativado.",
    });

    const on = asAdmin(ok);
    on.admin.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null });
    await expect(reactivateMember(on.clients, EDITOR_ID)).resolves.toEqual({
      status: "success",
      message: "Usuário reativado.",
    });
  });

  it("erro inesperado: mensagem genérica ao usuário, detalhe só no log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { clients } = asAdmin({ data: null, error: { code: "XX000", message: "connection reset" } });
    await expect(renameMember(clients, EDITOR_ID, "Novo")).resolves.toEqual({
      status: "error",
      message: "Não foi possível realizar a operação.",
    });
    expect(JSON.stringify(log.mock.calls)).toContain("connection reset");
  });
});
