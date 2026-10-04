// @vitest-environment node
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signIn } from "@/lib/agenda/authService";
import { changeUserRole, deactivateUser, inviteUser, listUsers, reactivateUser, type UserAdminClients } from "@/lib/agenda/usersAdmin";
import { resolvePanelAccess } from "@/lib/painel/access";
import { listAgenda } from "@/lib/painel/agenda";
import { changeMemberRole, deactivateMember, inviteMember } from "@/lib/painel/users";
import type { AgendaClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Usuários e permissões contra o Supabase REAL (Auth, RLS e triggers de verdade), pelo
 * mesmo código das Server Actions. Opt-in, pois cria dados temporários:
 *
 *   SUPABASE_REAL_TESTS=1 [PANEL_BASE_URL=http://localhost:3123] \
 *     node --env-file=.env.local node_modules/vitest/vitest.mjs run --project db supabase/tests/real/users.real.test.ts
 *
 * Com PANEL_BASE_URL (um `next start` rodando), também testa as rotas por HTTP com os
 * cookies de sessão reais de cada usuário. Tudo que é criado é apagado no final.
 */
const enabled = process.env.SUPABASE_REAL_TESTS === "1";
const baseUrl = process.env.PANEL_BASE_URL;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

const RUN = `${Date.now()}`;
const PASSWORD = `Teste-${RUN}-${Math.random().toString(36).slice(2)}`;
const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const newClient = () => createClient<Database>(url, publishableKey, noSession) as AgendaClient;
const secret = () => createClient<Database>(url, secretKey, noSession) as AgendaClient;

type TestUser = { id: string; email: string };
const created = new Set<string>(); // ids do Auth a apagar no final
let adminTest: TestUser;
let editorTest: TestUser;
// Uma sessão por usuário para a suíte inteira: o Auth limita logins por IP.
let adminClients: UserAdminClients;
let editorSession: AgendaClient;
let adminCookies = "";
let editorCookies = "";

async function createTestUser(label: string, role: "ADMIN" | "EDITOR"): Promise<TestUser> {
  const email = `painel-teste-${label}-${RUN}@example.com`;
  const { data, error } = await secret().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  created.add(data.user.id);
  const profile = await secret().from("profiles").insert({ id: data.user.id, name: `${label.toUpperCase()}_TEST`, role });
  if (profile.error) throw profile.error;
  return { id: data.user.id, email };
}

async function sessionFor(user: TestUser): Promise<AgendaClient> {
  const client = newClient();
  await signIn(client, user.email, PASSWORD);
  return client;
}

/** "Recarregar": lê tudo de novo do banco e do Auth (nada vem de estado em memória). */
async function reload(id: string) {
  return (await listUsers(adminClients)).find((member) => member.id === id);
}

/** Cookies de sessão exatamente como o @supabase/ssr grava no navegador. */
async function cookiesFor(user: TestUser): Promise<string> {
  const jar = new Map<string, string>();
  const client = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: PASSWORD });
  if (error) throw error;
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

/** Para onde a página manda: redirect HTTP ou, se já estava transmitindo, meta refresh. */
async function visit(path: string, cookie?: string) {
  const response = await fetch(new URL(path, baseUrl), { headers: cookie ? { cookie } : {}, redirect: "manual" });
  const body = response.status === 200 ? await response.text() : "";
  const location =
    response.headers.get("location") ?? body.match(/id="__next-page-redirect"[^>]*url=([^"]+)"/)?.[1] ?? null;
  return { status: response.status, location: location && decodeURIComponent(location.replace(/&amp;/g, "&")), body };
}

describe.skipIf(!enabled)("usuários e permissões no Supabase real", () => {
  beforeAll(async () => {
    const migration = await secret().rpc("get_team_names");
    if (migration.error) {
      throw new Error(`Migration 20260930120000_users_management não aplicada no projeto: ${migration.error.message}`);
    }
    adminTest = await createTestUser("admin", "ADMIN");
    editorTest = await createTestUser("editor", "EDITOR");
    adminClients = { caller: await sessionFor(adminTest), admin: secret() };
    editorSession = await sessionFor(editorTest);
    if (baseUrl) {
      adminCookies = await cookiesFor(adminTest);
      editorCookies = await cookiesFor(editorTest);
    }
  }, 60_000);

  afterAll(async () => {
    // A auditoria (created_by/updated_by → profiles) é RESTRICT e imutável: apaga na ordem
    // inversa da criação (convidado e EDITOR referenciam o ADMIN_TEST, nunca o contrário).
    for (const id of [...created].reverse()) {
      const { error } = await secret().auth.admin.deleteUser(id);
      if (error) console.error(`limpeza do usuário ${id} falhou`, error);
    }
  }, 60_000);

  describe("EDITOR_TEST: toda operação administrativa é bloqueada", () => {
    it("pela camada da aplicação (mesmas funções das Server Actions)", async () => {
      const clients = { caller: editorSession, admin: secret() };
      const inviteEmail = `painel-teste-editor-convite-${RUN}@example.com`;
      await expect(listUsers(clients)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        inviteUser(clients, { email: inviteEmail, name: "Nao", role: "ADMIN", redirectTo: "http://localhost:3000/auth/confirm" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(changeUserRole(clients, editorTest.id, "ADMIN")).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(changeUserRole(clients, adminTest.id, "EDITOR")).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(deactivateUser(clients, adminTest.id)).rejects.toMatchObject({ code: "FORBIDDEN" });

      const users = await secret().auth.admin.listUsers({ perPage: 1000 });
      expect(users.data.users.some((user) => user.email === inviteEmail)).toBe(false);
    });

    it("direto no banco (requisição manual com a sessão do EDITOR): RLS e trigger", async () => {
      const editor = editorSession;

      // Lista de perfis: só o próprio.
      const profiles = await editor.from("profiles").select("id");
      expect(profiles.data?.map((row) => row.id)).toEqual([editorTest.id]);

      // Escalada: promover a si mesmo, rebaixar/desativar o ADMIN, criar perfil ADMIN.
      await editor.from("profiles").update({ role: "ADMIN" }).eq("id", editorTest.id);
      await editor.from("profiles").update({ role: "EDITOR" }).eq("id", adminTest.id);
      await editor.from("profiles").update({ deactivated_at: new Date().toISOString() }).eq("id", adminTest.id);
      const insert = await editor.from("profiles").insert({ id: editorTest.id, name: "X", role: "ADMIN" });
      expect(insert.error).not.toBeNull();

      const check = await secret().from("profiles").select("id, role, deactivated_at").in("id", [editorTest.id, adminTest.id]);
      expect(Object.fromEntries((check.data ?? []).map((row) => [row.id, [row.role, row.deactivated_at]]))).toEqual({
        [editorTest.id]: ["EDITOR", null],
        [adminTest.id]: ["ADMIN", null],
      });

      // Nomes para a autoria da Agenda continuam disponíveis (só id e nome).
      const names = await editor.rpc("get_team_names");
      expect(names.error).toBeNull();
      expect(Object.keys(names.data?.[0] ?? {}).sort()).toEqual(["id", "name"]);
    });

    it("a Agenda do EDITOR continua funcionando", async () => {
      await expect(listAgenda(editorSession, "todos")).resolves.toBeInstanceOf(Array);
    });
  });

  describe.skipIf(!baseUrl)("rota /painel/usuarios por HTTP (servidor Next real)", () => {
    it("visitante → login", async () => {
      expect((await visit("/painel/usuarios")).location).toMatch(/\/painel\/login$/);
    });

    it("EDITOR → acesso negado, sem nenhum dado de usuários na resposta", async () => {
      const page = await visit("/painel/usuarios", editorCookies);
      expect(page.location).toMatch(/\/painel\/acesso-negado\?motivo=admin$/);
      expect(page.body).not.toContain(adminTest.email);
      expect(page.body).not.toContain(editorTest.email);
    });

    it("ADMIN → página de usuários com a equipe", async () => {
      const page = await visit("/painel/usuarios", adminCookies);
      expect(page.status).toBe(200);
      expect(page.location).toBeNull();
      expect(page.body).toContain(editorTest.email);
    });
  });

  describe("ADMIN_TEST: gestão completa com persistência", () => {
    it("lista usuários com e-mail, sem dados sensíveis", async () => {
      const members = await listUsers(adminClients);
      const editor = members.find((member) => member.id === editorTest.id);
      expect(editor).toMatchObject({ email: editorTest.email, role: "EDITOR", active: true });
      expect(JSON.stringify(members)).not.toMatch(/access_token|refresh_token|encrypted_password|app_metadata/);
    });

    it("convida: usuário no Auth + profile, com autoria do ADMIN", async () => {
      const email = `painel-teste-convite-${RUN}@example.com`;
      const result = await inviteMember(
        adminClients,
        { name: "Convidado Teste", email, role: "EDITOR" },
        "http://localhost:3000/auth/confirm?next=%2Fpainel%2Fconfiguracoes%2Fsenha%3Fconvite%3D1",
      );
      const users = await secret().auth.admin.listUsers({ perPage: 1000 });
      const invited = users.data.users.find((user) => user.email === email);
      if (invited) created.add(invited.id);

      expect(result).toEqual({ status: "success", message: "Usuário convidado com sucesso." });
      expect(invited?.invited_at).toBeTruthy();
      expect(await reload(invited!.id)).toMatchObject({
        name: "Convidado Teste",
        role: "EDITOR",
        active: true,
        invitePending: true,
        createdBy: adminTest.id,
      });
    });

    it("altera papel EDITOR → ADMIN → EDITOR (persistido)", async () => {
      await changeUserRole(adminClients, editorTest.id, "ADMIN");
      expect(await reload(editorTest.id)).toMatchObject({ role: "ADMIN", updatedBy: adminTest.id });
      await changeUserRole(adminClients, editorTest.id, "EDITOR");
      expect((await reload(editorTest.id))?.role).toBe("EDITOR");
    });

    it("não remove o próprio acesso administrativo", async () => {
      const clients = adminClients;
      const message = "Você não pode remover o próprio acesso administrativo.";
      await expect(changeMemberRole(clients, adminTest.id, "EDITOR")).resolves.toEqual({ status: "error", message });
      await expect(deactivateMember(clients, adminTest.id)).resolves.toEqual({ status: "error", message });

      // O banco recusa mesmo pulando a aplicação (AG004).
      const direct = await clients.caller.from("profiles").update({ role: "EDITOR" }).eq("id", adminTest.id);
      expect(direct.error).toMatchObject({ code: "AG004" });
      expect((await reload(adminTest.id))?.role).toBe("ADMIN");
    });

    it("desativar corta o acesso de uma sessão JÁ ABERTA do EDITOR; reativar devolve", async () => {
      await expect(resolvePanelAccess(editorSession)).resolves.toMatchObject({ status: "granted" });

      await deactivateUser(adminClients, editorTest.id);
      expect(await reload(editorTest.id)).toMatchObject({ active: false, deactivatedBy: adminTest.id });

      // Mesma sessão, nova requisição: sem acesso.
      await expect(resolvePanelAccess(editorSession)).resolves.toEqual({ status: "denied", reason: "deactivated" });
      await expect(listAgenda(editorSession, "todos")).resolves.toEqual([]);
      // E não entra de novo (login bloqueado no Auth).
      await expect(signIn(newClient(), editorTest.email, PASSWORD)).rejects.toMatchObject({ code: "FORBIDDEN" });

      if (baseUrl) {
        // Acesso negado (perfil desativado) ou login (sessão já recusada pelo Auth): ambos bloqueiam.
        const page = await visit("/painel/agenda", editorCookies);
        expect(page.location).toMatch(/\/painel\/(acesso-negado|login)$/);
      }

      await reactivateUser(adminClients, editorTest.id);
      expect(await reload(editorTest.id)).toMatchObject({ active: true, deactivatedAt: null });
      await expect(resolvePanelAccess(await sessionFor(editorTest))).resolves.toMatchObject({
        status: "granted",
        user: { role: "EDITOR" },
      });
    });
  });
});
