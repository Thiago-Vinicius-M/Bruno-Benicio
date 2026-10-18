import { AuthSessionMissingError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/agenda/testing/fakeSupabase";

/**
 * Server Actions dos WhatsApp (Configurações) chamadas "diretamente": só ADMIN, conferido no
 * servidor antes de qualquer chamada ao banco. Visibilidade por quem cadastrou e regras dos
 * canais: supabase/tests/sellerLinks.db.test.ts.
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

const operations = [
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
  it.each(operations)("%s: visitante vai para o login", async (_, run) => {
    session(null);
    await expect(run()).rejects.toThrow("REDIRECT /painel/login");
    expect(dbCalls()).toHaveLength(0);
  });

  it.each(operations)("%s: vendedor (SELLER) e EDITOR são recusados", async (_, run) => {
    for (const profile of [seller, editor]) {
      session(profile);
      await expect(run()).rejects.toThrow("REDIRECT /painel/acesso-negado?motivo=admin");
      expect(dbCalls()).toHaveLength(0);
    }
  });
});

describe("ADMIN", () => {
  it("cadastra WhatsApp para um usuário com o número normalizado; atualiza Configurações e Links", async () => {
    session(admin, [{ data: { id: ID }, error: null }]);
    expect(await actions.createChannelAction({ ...channelInput, active: false, redirect_channel_id: ID })).toMatchObject({ status: "success" });
    expect(state.caller.calls.find(([method]) => method === "insert")?.[1]).toEqual({
      owner_id: ME,
      whatsapp: "5562999998888",
      label: "Comercial",
      is_primary: false,
    });
    expect(state.revalidated).toEqual(["/painel/configuracoes/senha", "/painel/links"]);
  });
});
