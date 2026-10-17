import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/agenda/testing/fakeSupabase";

const state = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof createFakeSupabase> }));
vi.mock("@/lib/supabase/public", () => ({ createSupabasePublicClient: () => state.fake.client }));

const { GET } = await import("./route");

const CODE = "a1b2c3d4e5f6";
const PREVIOUS = "0f9e8d7c6b5a";
/** Link ativo (expira em 1 hora) ou inativo (canal de WhatsApp desativado). */
const seller = (active: boolean) => ({
  data: [
    {
      active,
      whatsapp: active ? "5562999998888" : null,
      link_kind: "link",
      status: active ? "active" : "inactive",
      expires_at: active ? new Date(Date.now() + 3_600_000).toISOString() : null,
    },
  ],
  error: null,
});

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
  it("link ativo: abre o site e associa a navegação (cookie até a expiração do link)", async () => {
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
    // Não dura além da validade do link (1 hora no fixture).
    expect(cookie?.maxAge).toBeGreaterThan(3500);
    expect(cookie?.maxAge).toBeLessThanOrEqual(3600);
  });

  it.each([
    ["inexistente", "inexistente", [{ data: [], error: null }]],
    ["banco fora do ar", "indisponivel", [{ data: null, error: { message: "fetch failed" } }]],
  ])("link %s: página de link inválido e associação anterior desfeita", async (_, reason, responses) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.fake = createFakeSupabase(responses);
    const response = await open(CODE, `bb_vendedor=${PREVIOUS}`);
    expect(response.headers.get("location")).toBe(`https://site.test/link-invalido?motivo=${reason}`);
    expect(clearedSellerCookie(response)).toBe(true);
  });

  it("link existente sem WhatsApp disponível: site público e associação anterior desfeita", async () => {
    state.fake = createFakeSupabase([seller(false)]);
    const response = await open(CODE, `bb_vendedor=${PREVIOUS}`);
    expect(response.headers.get("location")).toBe("https://site.test/");
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

describe("/r/<código> com link temporário (preços próprios)", () => {
  const TEMP = "0123456789abcdef";
  const tempLink = (status: string, expiresAt: string | null = null) => ({
    data: [
      {
        active: status === "active",
        whatsapp: status === "active" ? "5562999998888" : null,
        link_kind: "link",
        status,
        expires_at: status === "active" ? expiresAt : null,
      },
    ],
    error: null,
  });

  afterEach(() => vi.useRealTimers());

  it("válido: abre o site e o cookie dura no máximo até a expiração do link", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-17T12:00:00.000Z"));
    state.fake = createFakeSupabase([tempLink("active", "2026-10-18T12:00:30.900Z")]);
    const response = await open(TEMP);
    expect(response.headers.get("location")).toBe("https://site.test/");
    const cookie = response.cookies.get("bb_vendedor");
    expect(cookie?.value).toBe(TEMP);
    // 24h + 30,9 s → arredonda para baixo (nunca passa da validade).
    expect(cookie?.maxAge).toBe(86_430);
    expect(cookie?.sameSite).toBe("lax");
  });

  it.each(["expired", "revoked", "inactive", "invalid"])(
    "%s: site público (sem página de erro) e contexto comercial removido",
    async (status) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      state.fake = createFakeSupabase([tempLink(status)]);
      const response = await open(TEMP, `bb_vendedor=${TEMP}`);
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("https://site.test/");
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(clearedSellerCookie(response)).toBe(true);
    },
  );

  it("link expirado aberto depois de um link válido de outro vendedor: não herda o anterior", async () => {
    state.fake = createFakeSupabase([tempLink("expired")]);
    const response = await open(TEMP, `bb_vendedor=${PREVIOUS}`);
    expect(clearedSellerCookie(response)).toBe(true);
    expect(state.fake.calls).toEqual([["rpc", "get_seller_link", { p_code: TEMP }]]);
  });
});

/** Set-Cookie que apaga bb_vendedor (valor vazio, expirado). */
function clearedSellerCookie(response: Response) {
  const header = response.headers.get("set-cookie") ?? "";
  return /bb_vendedor=;/.test(header) && /(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(header);
}
