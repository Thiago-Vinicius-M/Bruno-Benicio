import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "@/lib/agenda/testing/fakeSupabase";
import { changePassword, field, loginWithPassword, sendRecoveryEmail, signOutQuietly } from "./authForms";

const user = { id: "00000000-0000-0000-0000-000000000001", email: "bruno@example.com" };
const session = { access_token: "token", user };
const activeProfile = { id: user.id, name: "Bruno", role: "ADMIN", deactivated_at: null };

/** Login aceito pelo Auth; `profileRow` é o que o banco devolve para o perfil. */
function authAccepts(profileRow: unknown) {
  const fake = createFakeSupabase([{ data: profileRow, error: null }]);
  fake.auth.signInWithPassword.mockResolvedValue({ data: { session, user }, error: null });
  fake.auth.getUser.mockResolvedValue({ data: { user }, error: null });
  fake.auth.signOut.mockResolvedValue({ error: null });
  return fake;
}

function authRejects(error: Error) {
  const fake = createFakeSupabase();
  fake.auth.signInWithPassword.mockResolvedValue({ data: { session: null, user: null }, error });
  return fake;
}

describe("login", () => {
  it("login correto com perfil ativo", async () => {
    const { client, auth } = authAccepts(activeProfile);
    await expect(loginWithPassword(client, "bruno@example.com", "senha-correta")).resolves.toMatchObject({
      status: "success",
    });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "bruno@example.com", password: "senha-correta" });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("senha incorreta mostra erro em português", async () => {
    const { client } = authRejects(new AuthApiError("Invalid login credentials", 400, "invalid_credentials"));
    await expect(loginWithPassword(client, "bruno@example.com", "errada")).resolves.toEqual({
      status: "error",
      message: "E-mail ou senha incorretos.",
    });
  });

  it("usuário inexistente recebe a mesma mensagem (não revela quem existe)", async () => {
    const { client } = authRejects(new AuthApiError("Invalid login credentials", 400, "invalid_credentials"));
    await expect(loginWithPassword(client, "ninguem@example.com", "qualquer")).resolves.toEqual({
      status: "error",
      message: "E-mail ou senha incorretos.",
    });
  });

  it("erro de autenticação (Auth fora do ar) vira mensagem genérica", async () => {
    const { client } = authRejects(new AuthRetryableFetchError("fetch failed", 0));
    await expect(loginWithPassword(client, "bruno@example.com", "senha")).resolves.toEqual({
      status: "error",
      message: "Erro inesperado. Tente novamente.",
    });
  });

  it("excesso de tentativas", async () => {
    const { client } = authRejects(new AuthApiError("rate", 429, "over_request_rate_limit"));
    await expect(loginWithPassword(client, "bruno@example.com", "senha")).resolves.toMatchObject({
      message: "Muitas tentativas. Aguarde alguns instantes e tente novamente.",
    });
  });

  it("usuário banido (desativado) no Auth não entra", async () => {
    const { client } = authRejects(new AuthApiError("User is banned", 400, "user_banned"));
    await expect(loginWithPassword(client, "bruno@example.com", "senha")).resolves.toEqual({
      status: "error",
      message: "Este usuário está desativado.",
    });
  });

  it("campos vazios não chamam o Auth", async () => {
    const { client, auth } = createFakeSupabase();
    await expect(loginWithPassword(client, "", "")).resolves.toMatchObject({ status: "error" });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("sessão válida sem profile: nega e encerra a sessão criada", async () => {
    const { client, auth } = authAccepts(null);
    await expect(loginWithPassword(client, "bruno@example.com", "senha")).resolves.toMatchObject({
      status: "error",
      message: expect.stringContaining("não tem acesso"),
    });
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it("sessão válida com perfil desativado: nega e encerra a sessão criada", async () => {
    const { client, auth } = authAccepts({ ...activeProfile, deactivated_at: "2026-09-10T00:00:00Z" });
    await expect(loginWithPassword(client, "bruno@example.com", "senha")).resolves.toMatchObject({
      status: "error",
      message: expect.stringContaining("desativado"),
    });
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it("falha ao ler o perfil também encerra a sessão", async () => {
    const fake = createFakeSupabase([{ data: null, error: { code: "XX000", message: "db down" } }]);
    fake.auth.signInWithPassword.mockResolvedValue({ data: { session, user }, error: null });
    fake.auth.getUser.mockResolvedValue({ data: { user }, error: null });
    fake.auth.signOut.mockResolvedValue({ error: null });

    await expect(loginWithPassword(fake.client, "bruno@example.com", "senha")).resolves.toMatchObject({ status: "error" });
    expect(fake.auth.signOut).toHaveBeenCalledOnce();
  });
});

describe("logout", () => {
  it("encerra a sessão no Supabase", async () => {
    const { client, auth } = createFakeSupabase();
    auth.signOut.mockResolvedValue({ error: null });
    await signOutQuietly(client);
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it("erro do Supabase não impede sair do painel", async () => {
    const { client, auth } = createFakeSupabase();
    auth.signOut.mockResolvedValue({ error: new AuthApiError("fail", 500, undefined) });
    await expect(signOutQuietly(client)).resolves.toBeUndefined();
  });

  it("usuário desativado (revogação recusada): apaga ao menos a sessão local", async () => {
    const { client, auth } = createFakeSupabase();
    auth.signOut
      .mockResolvedValueOnce({ error: new AuthApiError("User is banned", 403, "user_banned") })
      .mockResolvedValueOnce({ error: null });
    await signOutQuietly(client);
    expect(auth.signOut).toHaveBeenLastCalledWith({ scope: "local" });
  });
});

describe("recuperação de senha", () => {
  const redirectTo = "https://site/auth/confirm?next=%2Fpainel%2Fconfiguracoes%2Fsenha";

  it("envia pelo Supabase Auth com o redirect informado", async () => {
    const { client, auth } = createFakeSupabase();
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    await expect(sendRecoveryEmail(client, " bruno@example.com ", redirectTo)).resolves.toMatchObject({
      status: "success",
    });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("bruno@example.com", { redirectTo });
  });

  it("não revela se o e-mail existe quando o Auth falha", async () => {
    const { client, auth } = createFakeSupabase();
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: new AuthApiError("boom", 500, undefined) });
    await expect(sendRecoveryEmail(client, "x@example.com", redirectTo)).resolves.toMatchObject({ status: "success" });
  });

  it("informa e-mail vazio e excesso de tentativas", async () => {
    const { client, auth } = createFakeSupabase();
    await expect(sendRecoveryEmail(client, " ", redirectTo)).resolves.toMatchObject({ status: "error" });

    auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: new AuthApiError("rate", 429, "over_email_send_rate_limit"),
    });
    await expect(sendRecoveryEmail(client, "x@example.com", redirectTo)).resolves.toMatchObject({ status: "error" });
  });
});

describe("alteração de senha", () => {
  it("confirmação diferente não chama o Auth", async () => {
    const { client, auth } = createFakeSupabase();
    await expect(changePassword(client, "nova-senha-1", "nova-senha-2")).resolves.toEqual({
      status: "error",
      message: "As senhas não conferem.",
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("campos vazios", async () => {
    const { client } = createFakeSupabase();
    await expect(changePassword(client, "", "")).resolves.toMatchObject({ status: "error" });
  });

  it("alteração válida usa updateUser do Supabase e confirma", async () => {
    const { client, auth } = createFakeSupabase();
    auth.updateUser.mockResolvedValue({ data: { user }, error: null });
    const result = await changePassword(client, "nova-senha-forte", "nova-senha-forte");

    expect(result).toEqual({ status: "success", message: "Senha alterada com sucesso." });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "nova-senha-forte" });
    // A senha nunca volta na resposta do formulário.
    expect(JSON.stringify(result)).not.toContain("nova-senha-forte");
  });

  it("senha curta é recusada antes do Auth", async () => {
    const { client, auth } = createFakeSupabase();
    await expect(changePassword(client, "curta", "curta")).resolves.toMatchObject({ status: "error" });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("erro da API vira mensagem amigável", async () => {
    const { client, auth } = createFakeSupabase();
    auth.updateUser.mockResolvedValue({ data: {}, error: new AuthApiError("same", 422, "same_password") });
    await expect(changePassword(client, "mesma-senha", "mesma-senha")).resolves.toEqual({
      status: "error",
      message: "A nova senha deve ser diferente da atual.",
    });
  });
});

describe("field", () => {
  it("lê strings e ignora ausência/arquivos", () => {
    const data = new FormData();
    data.set("email", "a@b.com");
    data.set("file", new Blob(["x"]));
    expect(field(data, "email")).toBe("a@b.com");
    expect(field(data, "file")).toBe("");
    expect(field(data, "missing")).toBe("");
  });
});
