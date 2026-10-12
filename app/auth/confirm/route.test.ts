import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const { GET } = await import("./route");

const call = (query: string) => GET(new NextRequest(new URL(`/auth/confirm${query}`, "https://site.test")));

beforeEach(() => {
  auth.verifyOtp.mockReset().mockResolvedValue({ error: null });
  auth.exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
});

describe("/auth/confirm (volta do e-mail de recuperação)", () => {
  it("token_hash de recuperação abre a troca de senha", async () => {
    await expect(call("?token_hash=abc&type=recovery")).rejects.toThrow(
      "REDIRECT /painel/configuracoes/senha?recuperacao=1",
    );
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "abc" });
  });

  it("code (PKCE) com next do painel", async () => {
    await expect(call("?code=xyz&next=%2Fpainel%2Fconfiguracoes%2Fsenha%3Frecuperacao%3D1")).rejects.toThrow(
      "REDIRECT /painel/configuracoes/senha?recuperacao=1",
    );
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("xyz");
  });

  it("link inválido ou expirado volta ao login com aviso", async () => {
    auth.verifyOtp.mockResolvedValue({ error: new Error("expired") });
    await expect(call("?token_hash=abc&type=recovery")).rejects.toThrow("REDIRECT /painel/login?erro=link");
  });

  it("tipo não aceito (inclusive convite) não cria sessão", async () => {
    for (const type of ["signup", "invite"]) {
      await expect(call(`?token_hash=abc&type=${type}`)).rejects.toThrow("REDIRECT /painel/login?erro=link");
    }
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("sem token na query volta ao login com aviso", async () => {
    await expect(call("?next=%2Fpainel")).rejects.toThrow("REDIRECT /painel/login?erro=link");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("next externo é ignorado (sem open redirect)", async () => {
    await expect(call("?code=xyz&next=https%3A%2F%2Fevil.com")).rejects.toThrow(/^REDIRECT \/painel$/);
  });
});
