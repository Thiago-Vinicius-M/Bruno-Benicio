import { AuthSessionMissingError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/agenda/testing/fakeSupabase";

/**
 * Server Actions de shows com a sessão simulada: quem pode executar e o que chega ao
 * banco. O RLS/trigger real é coberto em supabase/tests/agenda.db.test.ts.
 */
const state = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof createFakeSupabase>,
  revalidated: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => state.fake.client }));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => state.revalidated.push(path) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const { createShowAction, deleteShowAction, restoreShowAction, updateShowAction } = await import("./actions");

const USER_ID = "00000000-0000-0000-0000-000000000001";
const SHOW_ID = "11111111-1111-4111-8111-111111111111";
const input = { showDate: "2026-10-05", showTime: "21:00", venueName: "Villa Mix", venueInstagram: "@villamix" };
const ok = { data: { id: SHOW_ID }, error: null };

/** Sessão com perfil: 1ª resposta = perfil (requirePanelUser), 2ª = operação no show. */
function signedInAs(role: "ADMIN" | "EDITOR", operation = ok) {
  state.fake = createFakeSupabase([
    { data: { id: USER_ID, name: "Teste", role, deactivated_at: null }, error: null },
    operation,
  ]);
  state.fake.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
}

const tablesTouched = () => state.fake.calls.filter(([m]) => m === "from").map(([, table]) => table);

beforeEach(() => {
  state.revalidated = [];
});

const operations = [
  ["criar", () => createShowAction(input), "Show criado com sucesso."],
  ["editar", () => updateShowAction(SHOW_ID, input), "Show atualizado com sucesso."],
  ["excluir", () => deleteShowAction(SHOW_ID), "Show excluído com sucesso."],
  ["restaurar", () => restoreShowAction(SHOW_ID), "Show restaurado com sucesso."],
] as const;

describe.each(["ADMIN", "EDITOR"] as const)("%s", (role) => {
  it.each(operations)("pode %s e a lista é revalidada", async (_, run, message) => {
    signedInAs(role);
    await expect(run()).resolves.toEqual({ status: "success", message });
    expect(tablesTouched()).toEqual(["profiles", "shows"]);
    expect(state.revalidated).toEqual(["/painel/agenda"]);
  });
});

describe("segurança", () => {
  it.each(operations)("visitante não pode %s (vai para o login, banco intocado)", async (_, run) => {
    state.fake = createFakeSupabase();
    state.fake.auth.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() });
    await expect(run()).rejects.toThrow("REDIRECT /painel/login");
    expect(tablesTouched()).toEqual([]);
    expect(state.revalidated).toEqual([]);
  });

  it("usuário desativado não pode operar", async () => {
    state.fake = createFakeSupabase([
      { data: { id: USER_ID, name: "X", role: "EDITOR", deactivated_at: "2026-09-10T00:00:00Z" }, error: null },
    ]);
    state.fake.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    await expect(createShowAction(input)).rejects.toThrow("REDIRECT /painel/acesso-negado");
    expect(tablesTouched()).toEqual(["profiles"]);
  });

  it("falha não revalida a lista e devolve mensagem amigável", async () => {
    signedInAs("EDITOR", { data: null, error: { code: "42501", message: "rls" } } as never);
    await expect(createShowAction(input)).resolves.toEqual({
      status: "error",
      message: "Você não tem permissão para esta operação.",
    });
    expect(state.revalidated).toEqual([]);
  });
});
