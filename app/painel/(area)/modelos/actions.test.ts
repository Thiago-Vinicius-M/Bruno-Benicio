import { AuthSessionMissingError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/agenda/testing/fakeSupabase";

/**
 * Server Actions de Modelos de Show chamadas "diretamente" (como faria um EDITOR,
 * vendedor ou visitante com uma requisição manual): a autorização acontece no servidor,
 * antes de qualquer escrita. RLS: supabase/tests/showModelsSellers.db.test.ts.
 * Links comerciais: ../links/actions.test.ts.
 */
const state = vi.hoisted(() => ({
  caller: null as unknown as ReturnType<typeof createFakeSupabase>,
  revalidated: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => state.caller.client }));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => state.revalidated.push(path) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const models = await import("./actions");

const ME = "00000000-0000-4000-8000-000000000001";
const ID = "00000000-0000-4000-8000-0000000000aa";
const modelInput = { name: "Acústico", duration: "1h30 de show", price: "990,00" };

/** Respostas do banco em ordem: perfil (requirePanelAdmin) e depois a operação. */
function session(profile: object | null, rest: { data: unknown; error: unknown }[] = []) {
  state.caller = createFakeSupabase(profile ? [{ data: profile, error: null }, ...rest] : []);
  state.caller.auth.getUser.mockResolvedValue(
    profile ? { data: { user: { id: ME } }, error: null } : { data: { user: null }, error: new AuthSessionMissingError() },
  );
}

const admin = { id: ME, name: "Admin", role: "ADMIN", deactivated_at: null };
const editor = { ...admin, role: "EDITOR" };
const seller = { ...admin, role: "SELLER" };
const deactivatedAdmin = { ...admin, deactivated_at: "2026-10-01T00:00:00Z" };

const operations = [
  ["criar modelo", () => models.createShowModelAction(modelInput)],
  ["editar modelo", () => models.updateShowModelAction(ID, modelInput)],
  ["desativar modelo", () => models.setShowModelActiveAction(ID, false)],
  ["mudar ordem", () => models.moveShowModelAction(ID, "up")],
] as const;

const writes = () => state.caller.calls.filter(([method]) => method === "insert" || method === "update" || method === "rpc");

beforeEach(() => {
  state.revalidated = [];
});

describe("autorização (antes de qualquer escrita)", () => {
  it.each(operations)("%s: visitante vai para o login", async (_, run) => {
    session(null);
    await expect(run()).rejects.toThrow("REDIRECT /painel/login");
    expect(writes()).toHaveLength(0);
  });

  it.each(operations)("%s: EDITOR é recusado", async (_, run) => {
    session(editor);
    await expect(run()).rejects.toThrow("REDIRECT /painel/acesso-negado?motivo=admin");
    expect(writes()).toHaveLength(0);
  });

  it.each(operations)("%s: vendedor (SELLER) não altera preços padrão", async (_, run) => {
    session(seller);
    await expect(run()).rejects.toThrow("REDIRECT /painel/acesso-negado?motivo=admin");
    expect(writes()).toHaveLength(0);
  });

  it.each(operations)("%s: ADMIN desativado é recusado", async (_, run) => {
    session(deactivatedAdmin);
    await expect(run()).rejects.toThrow("REDIRECT /painel/acesso-negado");
    expect(writes()).toHaveLength(0);
  });
});

describe("ADMIN", () => {
  it("criar modelo grava só os campos do formulário e publica no site", async () => {
    session(admin, [{ data: { id: ID, price: 990 }, error: null }]);
    const result = await models.createShowModelAction({ ...modelInput, created_by: "outro", position: -1, active: true });
    expect(result).toEqual({ status: "success", message: "Modelo de show adicionado." });
    expect(state.caller.calls.find(([method]) => method === "insert")?.[1]).toEqual({
      name: "Acústico",
      duration: "1h30 de show",
      description: null,
      price: 990,
      active: true,
    });
    expect(state.revalidated).toEqual(["/painel/modelos", "/"]);
  });

  it("nome repetido e erro inesperado viram mensagens amigáveis; nada é revalidado", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    session(admin, [{ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } }]);
    expect(await models.createShowModelAction(modelInput)).toEqual({
      status: "error",
      message: "Já existe um modelo com este nome.",
    });
    session(admin, [{ data: null, error: { code: "XX000", message: "boom" } }]);
    expect(await models.updateShowModelAction(ID, modelInput)).toEqual({
      status: "error",
      message: "Não foi possível salvar o modelo. Tente novamente.",
    });
    expect(state.revalidated).toEqual([]);
  });

  it("dados inválidos não chegam ao banco", async () => {
    const attempts = [
      () => models.createShowModelAction({ ...modelInput, price: "abc" }),
      () => models.updateShowModelAction("não-é-uuid", modelInput),
      () => models.moveShowModelAction(ID, "sideways"),
    ];
    for (const attempt of attempts) {
      session(admin);
      expect(await attempt()).toMatchObject({ status: "error" });
      expect(writes()).toHaveLength(0);
    }
  });

  it("ativar e desativar mudam só o status", async () => {
    session(admin, [{ data: { id: ID, price: 1 }, error: null }]);
    expect(await models.setShowModelActiveAction(ID, false)).toEqual({
      status: "success",
      message: "Modelo desativado: não aparece mais no site.",
    });
    expect(state.caller.calls.find(([method]) => method === "update")?.[1]).toEqual({ active: false });
  });
});
