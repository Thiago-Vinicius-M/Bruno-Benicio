import { AuthSessionMissingError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/agenda/testing/fakeSupabase";

/**
 * Server Actions de Links comerciais chamadas "diretamente" (requisição manual): o papel é
 * conferido no servidor antes de qualquer chamada ao banco. Links: ADMIN e SELLER. Canais
 * de WhatsApp e links permanentes antigos: só ADMIN. As regras de dono do canal, valores e
 * isolamento entre usuários: supabase/tests/sellerLinks.db.test.ts.
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

const actions = await import("./actions");

const ME = "00000000-0000-4000-8000-000000000001";
const ID = "00000000-0000-4000-8000-0000000000aa";
const M1 = "11111111-1111-4111-8111-111111111111";
const linkInput = { channelId: ID, label: "", validity: "24h", items: [{ modelId: M1 }] };
const channelInput = { ownerId: ME, whatsapp: "+55 62 99999-8888", label: "Comercial" };

/** Respostas do banco em ordem: perfil (guard do papel) e depois a operação. */
function session(profile: object | null, rest: { data: unknown; error: unknown }[] = []) {
  state.caller = createFakeSupabase(profile ? [{ data: profile, error: null }, ...rest] : []);
  state.caller.auth.getUser.mockResolvedValue(
    profile ? { data: { user: { id: ME } }, error: null } : { data: { user: null }, error: new AuthSessionMissingError() },
  );
}

const admin = { id: ME, name: "Admin", role: "ADMIN", deactivated_at: null };
const editor = { ...admin, role: "EDITOR" };
const seller = { ...admin, role: "SELLER" };
const deactivatedSeller = { ...seller, deactivated_at: "2026-10-01T00:00:00Z" };

const linkOperations = [
  ["criar link", () => actions.createCommercialLinkAction(linkInput)],
  ["desativar link", () => actions.deactivateCommercialLinkAction(ID)],
] as const;

const adminOperations = [
  ["cadastrar WhatsApp", () => actions.createChannelAction(channelInput)],
  ["editar WhatsApp", () => actions.updateChannelAction(ID, { label: "X" })],
  ["desativar WhatsApp", () => actions.deactivateChannelAction(ID, null)],
  ["reativar WhatsApp", () => actions.activateChannelAction(ID)],
] as const;

const dbCalls = () => state.caller.calls.filter(([method]) => method === "insert" || method === "update" || method === "rpc");

beforeEach(() => {
  state.revalidated = [];
});

describe("autorização (antes de qualquer chamada ao banco)", () => {
  it.each([...linkOperations, ...adminOperations])("%s: visitante vai para o login", async (_, run) => {
    session(null);
    await expect(run()).rejects.toThrow("REDIRECT /painel/login");
    expect(dbCalls()).toHaveLength(0);
  });

  it.each(linkOperations)("%s: EDITOR é recusado", async (_, run) => {
    session(editor);
    await expect(run()).rejects.toThrow("REDIRECT /painel/acesso-negado?motivo=perfil");
    expect(dbCalls()).toHaveLength(0);
  });

  it.each(linkOperations)("%s: vendedor desativado é recusado", async (_, run) => {
    session(deactivatedSeller);
    await expect(run()).rejects.toThrow("REDIRECT /painel/acesso-negado");
    expect(dbCalls()).toHaveLength(0);
  });

  it.each(adminOperations)("%s: vendedor (SELLER) e EDITOR são recusados", async (_, run) => {
    for (const profile of [seller, editor]) {
      session(profile);
      await expect(run()).rejects.toThrow("REDIRECT /painel/acesso-negado?motivo=admin");
      expect(dbCalls()).toHaveLength(0);
    }
  });
});

describe("vendedor (SELLER)", () => {
  it("cria link pela função do banco, só com o que escolheu", async () => {
    session(seller, [{ data: [{ id: ID, code: "0123456789abcdef", expires_at: "x" }], error: null }]);
    expect(await actions.createCommercialLinkAction({ ...linkInput, whatsapp: "5511999999999", created_by: "outro" })).toEqual({
      status: "success",
      message: "Link criado. Copie e envie para o cliente.",
      code: "0123456789abcdef",
    });
    expect(dbCalls()).toEqual([
      [
        "rpc",
        "create_commercial_link",
        { p_channel_id: ID, p_label: null, p_validity: "24h", p_expires_at: null, p_items: [{ model_id: M1 }] },
      ],
    ]);
    expect(state.revalidated).toEqual(["/painel/links"]);
  });

  it("sem WhatsApp escolhido: nada chega ao banco", async () => {
    session(seller);
    expect(await actions.createCommercialLinkAction({ ...linkInput, channelId: "" })).toMatchObject({ status: "error" });
    expect(dbCalls()).toHaveLength(0);
    expect(state.revalidated).toEqual([]);
  });
});

describe("ADMIN", () => {
  it("cadastra WhatsApp para um usuário com o número normalizado", async () => {
    session(admin, [{ data: { id: ID }, error: null }]);
    expect(await actions.createChannelAction({ ...channelInput, active: false, redirect_channel_id: ID })).toMatchObject({ status: "success" });
    expect(state.caller.calls.find(([method]) => method === "insert")?.[1]).toEqual({
      owner_id: ME,
      whatsapp: "5562999998888",
      label: "Comercial",
      is_primary: false,
    });
  });
});
