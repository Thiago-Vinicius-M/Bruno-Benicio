import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Proxy de ponta a ponta com o cliente do Supabase simulado: `claims` define se há
 * sessão válida e `refreshed` simula o refresh do token gravando cookies novos.
 */
const auth = vi.hoisted(() => ({ claims: null as { sub: string } | null, refreshed: false }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (cookies: unknown[], headers: Record<string, string>) => void } }) => ({
    auth: {
      getClaims: async () => {
        if (auth.refreshed) {
          options.cookies.setAll([{ name: "sb-test-auth-token", value: "novo", options: { path: "/" } }], {
            "Cache-Control": "private, no-store",
          });
        }
        return { data: auth.claims ? { claims: auth.claims } : null, error: null };
      },
    },
  }),
}));

const { proxy, config } = await import("@/proxy");

const request = (path: string) => new NextRequest(new URL(path, "https://site.test"));

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_x";
  auth.claims = null;
  auth.refreshed = false;
});

describe("proxy do painel", () => {
  it("cenário 1: visitante em /painel é redirecionado para /painel/login", async () => {
    const response = await proxy(request("/painel"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://site.test/painel/login");
  });

  it("cenário 2: usuário autenticado acessa /painel", async () => {
    auth.claims = { sub: "user-1" };
    const response = await proxy(request("/painel"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("cenário 3: autenticado em /painel/login vai para /painel", async () => {
    auth.claims = { sub: "user-1" };
    const response = await proxy(request("/painel/login"));
    expect(response.headers.get("location")).toBe("https://site.test/painel");
  });

  it("visitante vê login e recuperação normalmente", async () => {
    for (const path of ["/painel/login", "/painel/recuperar-senha"]) {
      expect((await proxy(request(path))).headers.get("location")).toBeNull();
    }
  });

  it("o redirect preserva os cookies da sessão renovada", async () => {
    auth.claims = { sub: "user-1" };
    auth.refreshed = true;
    const response = await proxy(request("/painel/login"));
    expect(response.headers.get("location")).toBe("https://site.test/painel");
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("novo");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("o callback /auth/confirm passa sem redirecionamento", async () => {
    const response = await proxy(request("/auth/confirm?token_hash=abc&type=recovery"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("só roda no painel e nos callbacks de auth (site público fica de fora)", () => {
    expect(config.matcher).toEqual(["/painel/:path*", "/auth/:path*"]);
  });
});
