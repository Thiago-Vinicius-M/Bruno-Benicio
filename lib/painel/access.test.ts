import { AuthApiError, AuthSessionMissingError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "@/lib/agenda/testing/fakeSupabase";
import { resolvePanelAccess, ROLE_LABELS } from "./access";

const user = { id: "00000000-0000-0000-0000-000000000001", email: "bruno@example.com" };
const profile = (overrides: object) => ({
  id: user.id,
  name: "Bruno",
  role: "ADMIN",
  deactivated_at: null,
  deactivated_by: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  ...overrides,
});

function loggedIn(profileRow: unknown) {
  const fake = createFakeSupabase([{ data: profileRow, error: null }]);
  fake.auth.getUser.mockResolvedValue({ data: { user }, error: null });
  return fake;
}

describe("acesso ao painel", () => {
  it("visitante sem sessão é anônimo (e o banco nem é consultado)", async () => {
    const { client, auth, calls } = createFakeSupabase();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() });

    await expect(resolvePanelAccess(client)).resolves.toEqual({ status: "anonymous" });
    expect(calls).toEqual([]);
  });

  it("ADMIN ativo entra, com papel lido do perfil", async () => {
    const { client, calls } = loggedIn(profile({ role: "ADMIN" }));
    await expect(resolvePanelAccess(client)).resolves.toEqual({
      status: "granted",
      user: { id: user.id, name: "Bruno", role: "ADMIN" },
    });
    // O perfil consultado é o do usuário da sessão validada pelo Auth.
    expect(calls).toContainEqual(["eq", "id", user.id]);
  });

  it("EDITOR ativo entra como EDITOR", async () => {
    const { client } = loggedIn(profile({ name: "Thiago", role: "EDITOR" }));
    await expect(resolvePanelAccess(client)).resolves.toMatchObject({
      status: "granted",
      user: { name: "Thiago", role: "EDITOR" },
    });
  });

  it("cenário 4: usuário desativado é negado mesmo com sessão", async () => {
    const { client } = loggedIn(profile({ deactivated_at: "2026-09-10T00:00:00Z" }));
    await expect(resolvePanelAccess(client)).resolves.toEqual({ status: "denied", reason: "deactivated" });
  });

  it("cenário 5: usuário sem profile é negado mesmo com sessão", async () => {
    const { client } = loggedIn(null);
    await expect(resolvePanelAccess(client)).resolves.toEqual({ status: "denied", reason: "no-profile" });
  });

  it("sessão aberta de usuário desativado (banido no Auth) vira acesso negado, não erro", async () => {
    const { client, auth, calls } = createFakeSupabase();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError("User is banned", 403, "user_banned") });
    await expect(resolvePanelAccess(client)).resolves.toEqual({ status: "denied", reason: "deactivated" });
    expect(calls).toEqual([]);
  });

  it("falha do Auth não vira acesso liberado", async () => {
    const { client, auth } = createFakeSupabase();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError("boom", 500, undefined) });
    await expect(resolvePanelAccess(client)).rejects.toMatchObject({ code: "UNKNOWN" });
  });

  it("o DTO não expõe campos além de id, nome e papel", async () => {
    const { client } = loggedIn(profile({ role: "EDITOR" }));
    const access = await resolvePanelAccess(client);
    expect(access.status === "granted" && Object.keys(access.user).sort()).toEqual(["id", "name", "role"]);
  });

  it("labels amigáveis dos papéis", () => {
    expect(ROLE_LABELS).toEqual({ ADMIN: "Administrador", EDITOR: "Editor" });
  });
});
