import { AuthSessionMissingError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/agenda/testing/fakeSupabase";

/**
 * Proteção no servidor (camada que vale mesmo se o proxy for contornado): cada
 * página protegida chama `requirePanelUser`.
 */
const state = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof createFakeSupabase> }));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => state.fake.client }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const { requirePanelAdmin, requirePanelUser } = await import("./session");

const user = { id: "00000000-0000-0000-0000-000000000001" };

function withSession(profileRow: unknown) {
  state.fake = createFakeSupabase([{ data: profileRow, error: null }]);
  state.fake.auth.getUser.mockResolvedValue({ data: { user }, error: null });
}

beforeEach(() => {
  state.fake = createFakeSupabase();
  state.fake.auth.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() });
});

describe("requirePanelUser", () => {
  it("visitante é mandado para o login", async () => {
    await expect(requirePanelUser()).rejects.toThrow("REDIRECT /painel/login");
  });

  it("ADMIN recebe o próprio perfil", async () => {
    withSession({ id: user.id, name: "Bruno", role: "ADMIN", deactivated_at: null });
    await expect(requirePanelUser()).resolves.toEqual({ id: user.id, name: "Bruno", role: "ADMIN" });
  });

  it("EDITOR recebe o próprio perfil", async () => {
    withSession({ id: user.id, name: "Thiago", role: "EDITOR", deactivated_at: null });
    await expect(requirePanelUser()).resolves.toMatchObject({ role: "EDITOR" });
  });

  it("desativado vai para acesso negado (não para o login: sem loop)", async () => {
    withSession({ id: user.id, name: "X", role: "ADMIN", deactivated_at: "2026-09-10T00:00:00Z" });
    await expect(requirePanelUser()).rejects.toThrow("REDIRECT /painel/acesso-negado");
  });

  it("sem profile vai para acesso negado", async () => {
    withSession(null);
    await expect(requirePanelUser()).rejects.toThrow("REDIRECT /painel/acesso-negado");
  });

  it("não consulta dados financeiros nem shows", async () => {
    withSession({ id: user.id, name: "Bruno", role: "ADMIN", deactivated_at: null });
    await requirePanelUser();
    const tables = state.fake.calls.filter(([method]) => method === "from").map(([, table]) => table);
    expect(tables).toEqual(["profiles"]);
  });
});

describe("requirePanelAdmin (/painel/usuarios e ações de usuários)", () => {
  it("visitante vai para o login", async () => {
    await expect(requirePanelAdmin()).rejects.toThrow("REDIRECT /painel/login");
  });

  it("EDITOR recebe acesso negado", async () => {
    withSession({ id: user.id, name: "Thiago", role: "EDITOR", deactivated_at: null });
    await expect(requirePanelAdmin()).rejects.toThrow("REDIRECT /painel/acesso-negado?motivo=admin");
  });

  it("ADMIN desativado recebe acesso negado", async () => {
    withSession({ id: user.id, name: "X", role: "ADMIN", deactivated_at: "2026-09-10T00:00:00Z" });
    await expect(requirePanelAdmin()).rejects.toThrow("REDIRECT /painel/acesso-negado");
  });

  it("ADMIN ativo passa, com o papel lido do banco", async () => {
    withSession({ id: user.id, name: "Bruno", role: "ADMIN", deactivated_at: null });
    await expect(requirePanelAdmin()).resolves.toEqual({ id: user.id, name: "Bruno", role: "ADMIN" });
  });
});
