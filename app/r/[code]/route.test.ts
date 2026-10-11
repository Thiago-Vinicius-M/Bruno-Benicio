import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/agenda/testing/fakeSupabase";

const state = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof createFakeSupabase> }));
vi.mock("@/lib/supabase/public", () => ({ createSupabasePublicClient: () => state.fake.client }));

const { GET } = await import("./route");

const CODE = "a1b2c3d4e5f6";
const PREVIOUS = "0f9e8d7c6b5a";
const seller = (active: boolean) => ({ data: [{ active, whatsapp: active ? "5562999998888" : null }], error: null });

function open(code: string, cookie?: string) {
  const request = new NextRequest(new URL(`/r/${code}`, "https://site.test"), {
    headers: cookie ? { cookie } : undefined,
  });
  return GET(request, { params: Promise.resolve({ code }) });
}

beforeEach(() => {
  state.fake = createFakeSupabase();
});

describe("/r/<código> (link comercial do vendedor)", () => {
  it("vendedor ativo: abre o site e associa a navegação (cookie de sessão)", async () => {
    state.fake = createFakeSupabase([seller(true)]);
    const response = await open(CODE);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://site.test/");
    expect(response.headers.get("cache-control")).toContain("no-store");
    const cookie = response.cookies.get("bb_vendedor");
    expect(cookie?.value).toBe(CODE);
    expect(cookie?.path).toBe("/");
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.secure).toBe(true);
    // Cookie de sessão: some ao fechar o navegador.
    expect(cookie?.maxAge).toBeUndefined();
    expect(cookie?.expires).toBeUndefined();
  });

  it.each([
    ["inexistente", "inexistente", [{ data: [], error: null }]],
    ["desativado", "inativo", [seller(false)]],
    ["banco fora do ar", "indisponivel", [{ data: null, error: { message: "fetch failed" } }]],
  ])("vendedor %s: página de link inválido e associação anterior desfeita", async (_, reason, responses) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.fake = createFakeSupabase(responses);
    const response = await open(CODE, `bb_vendedor=${PREVIOUS}`);
    expect(response.headers.get("location")).toBe(`https://site.test/link-invalido?motivo=${reason}`);
    expect(clearedSellerCookie(response)).toBe(true);
  });

  it("link malformado nem consulta o banco", async () => {
    const response = await open("nao-e-um-codigo!");
    expect(response.headers.get("location")).toBe("https://site.test/link-invalido?motivo=malformado");
    expect(clearedSellerCookie(response)).toBe(true);
    expect(state.fake.calls).toHaveLength(0);
  });

  it("outro link válido aberto depois: a navegação comercial passa para o novo vendedor", async () => {
    state.fake = createFakeSupabase([seller(true)]);
    const response = await open(CODE, `bb_vendedor=${PREVIOUS}`);
    expect(response.headers.get("location")).toBe("https://site.test/");
    expect(response.cookies.get("bb_vendedor")?.value).toBe(CODE);
    // Só o código do link aberto é consultado; o anterior não interfere.
    expect(state.fake.calls).toEqual([["rpc", "get_seller_link", { p_code: CODE }]]);
  });
});

/** Set-Cookie que apaga bb_vendedor (valor vazio, expirado). */
function clearedSellerCookie(response: Response) {
  const header = response.headers.get("set-cookie") ?? "";
  return /bb_vendedor=;/.test(header) && /(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(header);
}
