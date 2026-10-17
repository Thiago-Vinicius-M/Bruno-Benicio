import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/agenda/testing/fakeSupabase";

const state = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof createFakeSupabase> }));
vi.mock("@/lib/supabase/public", () => ({ createSupabasePublicClient: () => state.fake.client }));

const { GET } = await import("./route");

const CODE = "k7m2q9xa";
const open = (code: string) =>
  GET(new NextRequest(new URL(`/p/${code}`, "https://site.test")), { params: Promise.resolve({ code }) });

/** A regra completa de abertura é testada em app/r/[code]/route.test.ts (mesma função). */
describe("/p/<código> (link comercial curto)", () => {
  it("link válido: abre o site, grava o código e o cookie dura até a expiração", async () => {
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    state.fake = createFakeSupabase([
      { data: [{ active: true, whatsapp: "5562999998888", link_kind: "link", status: "active", expires_at: expiresAt }], error: null },
    ]);
    const response = await open(CODE);
    expect(response.headers.get("location")).toBe("https://site.test/");
    expect(response.cookies.get("bb_vendedor")?.value).toBe(CODE);
    expect(response.cookies.get("bb_vendedor")?.maxAge).toBeGreaterThan(3500);
  });

  it("código malformado: página de link inválido e cookie apagado", async () => {
    state.fake = createFakeSupabase();
    const response = await open("../painel");
    expect(response.headers.get("location")).toBe("https://site.test/link-invalido?motivo=malformado");
    expect(state.fake.calls).toHaveLength(0);
  });
});
