import { AuthApiError, AuthSessionMissingError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { getSessionUser, requestPasswordReset, signIn, signOut, updatePassword } from "./authService";
import { AgendaError } from "./errors";
import { getCurrentProfile, requireAdmin } from "./profilesRepository";
import { createFakeSupabase } from "./testing/fakeSupabase";

const user = { id: "00000000-0000-0000-0000-000000000001", email: "bruno@example.com" };
const session = { access_token: "token", user };

describe("login", () => {
  it("login válido devolve a sessão", async () => {
    const { client, auth } = createFakeSupabase();
    auth.signInWithPassword.mockResolvedValue({ data: { session, user }, error: null });

    await expect(signIn(client, " bruno@example.com ", "senha-correta")).resolves.toBe(session);
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "bruno@example.com", password: "senha-correta" });
  });

  it("login inválido vira INVALID_CREDENTIALS com mensagem amigável", async () => {
    const { client, auth } = createFakeSupabase();
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
    });

    const error = await signIn(client, "bruno@example.com", "errada").catch((e) => e);
    expect(error).toBeInstanceOf(AgendaError);
    expect(error).toMatchObject({ code: "INVALID_CREDENTIALS", message: "E-mail ou senha incorretos." });
  });

  it("usuário desativado (banido no Auth) recebe FORBIDDEN", async () => {
    const { client, auth } = createFakeSupabase();
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError("User is banned", 400, "user_banned"),
    });
    await expect(signIn(client, "x@example.com", "senha")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("não chama o Auth sem e-mail ou senha", async () => {
    const { client, auth } = createFakeSupabase();
    await expect(signIn(client, " ", "")).rejects.toMatchObject({ code: "VALIDATION" });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("sessão", () => {
  it("devolve o usuário da sessão validada", async () => {
    const { client, auth } = createFakeSupabase();
    auth.getUser.mockResolvedValue({ data: { user }, error: null });
    await expect(getSessionUser(client)).resolves.toBe(user);
  });

  it("sem sessão devolve null (não é erro)", async () => {
    const { client, auth } = createFakeSupabase();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() });
    await expect(getSessionUser(client)).resolves.toBeNull();
  });

  it("falha de rede é propagada, não escondida", async () => {
    const { client, auth } = createFakeSupabase();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError("boom", 500, undefined) });
    await expect(getSessionUser(client)).rejects.toMatchObject({ code: "UNKNOWN" });
  });

  it("usuário do Auth sem perfil não tem acesso ao painel", async () => {
    const { client, auth } = createFakeSupabase([{ data: null, error: null }]);
    auth.getUser.mockResolvedValue({ data: { user }, error: null });
    await expect(getCurrentProfile(client)).resolves.toBeNull();
  });

  it("requireAdmin barra EDITOR e usuário desativado", async () => {
    const editor = { id: user.id, role: "EDITOR", deactivated_at: null };
    const inactiveAdmin = { id: user.id, role: "ADMIN", deactivated_at: "2026-09-01T00:00:00Z" };
    for (const profile of [editor, inactiveAdmin]) {
      const { client, auth } = createFakeSupabase([{ data: profile, error: null }]);
      auth.getUser.mockResolvedValue({ data: { user }, error: null });
      await expect(requireAdmin(client)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
});

describe("logout, recuperação e troca de senha", () => {
  it("logout encerra a sessão no Auth", async () => {
    const { client, auth } = createFakeSupabase();
    auth.signOut.mockResolvedValue({ error: null });
    await signOut(client);
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it("erro no logout é propagado", async () => {
    const { client, auth } = createFakeSupabase();
    auth.signOut.mockResolvedValue({ error: new AuthApiError("fail", 500, undefined) });
    await expect(signOut(client)).rejects.toBeInstanceOf(AgendaError);
  });

  it("recuperação de senha usa o fluxo do Supabase Auth", async () => {
    const { client, auth } = createFakeSupabase();
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    await requestPasswordReset(client, "bruno@example.com", "https://site/auth/nova-senha");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("bruno@example.com", {
      redirectTo: "https://site/auth/nova-senha",
    });
  });

  it("troca de senha valida tamanho mínimo e mapeia senha fraca", async () => {
    const { client, auth } = createFakeSupabase();
    await expect(updatePassword(client, "curta")).rejects.toMatchObject({ code: "VALIDATION" });
    expect(auth.updateUser).not.toHaveBeenCalled();

    auth.updateUser.mockResolvedValue({ data: {}, error: new AuthApiError("weak", 422, "weak_password") });
    await expect(updatePassword(client, "12345678")).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
