// @vitest-environment node
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signIn } from "@/lib/agenda/authService";
import type { Show } from "@/lib/agenda/types";
import { createShowFromInput, deleteShowById, listAgenda, restoreShowById, updateShowFromInput } from "@/lib/painel/agenda";
import type { AgendaClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Agenda do painel contra o Supabase REAL (RLS, triggers e persistência de verdade),
 * pelo mesmo código que as Server Actions usam. Opt-in, pois cria dados temporários:
 *
 *   SUPABASE_REAL_TESTS=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run --project db supabase/tests/real
 *
 * Cria um ADMIN e um EDITOR de teste (@example.com) e apaga tudo no final.
 */
const enabled = process.env.SUPABASE_REAL_TESTS === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

const RUN = `${Date.now()}`;
const PASSWORD = `Teste-${RUN}-${Math.random().toString(36).slice(2)}`;
const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

const newClient = () => createClient<Database>(url, publishableKey, noSession) as AgendaClient;
const admin = () => createClient<Database>(url, secretKey, noSession) as AgendaClient;

const users: { id: string; email: string; role: "ADMIN" | "EDITOR" }[] = [];
const venues: string[] = [];

/** "Recarregar a página": sessão nova, dados lidos de novo do banco. */
async function reload(email: string, filter: "todos" | "excluidos", venue: string): Promise<Show | undefined> {
  const client = newClient();
  await signIn(client, email, PASSWORD);
  return (await listAgenda(client, filter)).find((show) => show.venue_name === venue);
}

describe.skipIf(!enabled)("agenda no Supabase real", () => {
  beforeAll(async () => {
    for (const role of ["ADMIN", "EDITOR"] as const) {
      const email = `agenda-teste-${role.toLowerCase()}-${RUN}@example.com`;
      const { data, error } = await admin().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (error) throw error;
      users.push({ id: data.user.id, email, role });
      const profile = await admin().from("profiles").insert({ id: data.user.id, name: `Teste ${role}`, role });
      if (profile.error) throw profile.error;
    }
  }, 60_000);

  afterAll(async () => {
    // Limpeza com a secret key: o soft delete é a regra da aplicação, não do teste.
    if (venues.length) {
      const shows = await admin().from("shows").delete().in("venue_name", venues);
      if (shows.error) console.error("limpeza de shows falhou", shows.error);
    }
    for (const user of users) {
      const { error } = await admin().auth.admin.deleteUser(user.id);
      if (error) console.error(`limpeza do usuário ${user.email} falhou`, error);
    }
  }, 60_000);

  it.each(["ADMIN", "EDITOR"] as const)(
    "%s: criar → editar → excluir → restaurar, com persistência e auditoria",
    async (role) => {
      const user = users.find((u) => u.role === role)!;
      const venue = `ZZ Teste ${role} ${RUN}`;
      venues.push(venue);
      const client = newClient();
      await signIn(client, user.email, PASSWORD);

      // Criar
      const created = await createShowFromInput(client, {
        showDate: "2026-10-05",
        showTime: "21:30",
        venueName: ` ${venue} `,
        venueInstagram: "https://instagram.com/CasaTeste",
        created_by: "00000000-0000-0000-0000-000000000000", // forjado: deve ser ignorado
      });
      expect(created).toEqual({ status: "success", message: "Show criado com sucesso." });
      const afterCreate = await reload(user.email, "todos", venue);
      expect(afterCreate).toMatchObject({
        show_date: "2026-10-05", // data de calendário intacta
        show_time: "21:30:00", // horário de parede intacto
        venue_instagram: "casateste",
        created_by: user.id,
        updated_by: user.id,
        deleted_at: null,
      });
      const id = afterCreate!.id;

      // Editar
      await expect(
        updateShowFromInput(client, id, {
          showDate: "2026-10-31",
          showTime: "23:45",
          venueName: venue,
          venueInstagram: "@outra.casa",
        }),
      ).resolves.toMatchObject({ status: "success" });
      const afterEdit = await reload(user.email, "todos", venue);
      expect(afterEdit).toMatchObject({
        id,
        show_date: "2026-10-31",
        show_time: "23:45:00",
        venue_instagram: "outra.casa",
        created_by: user.id,
        created_at: afterCreate!.created_at,
        updated_by: user.id,
      });
      expect(new Date(afterEdit!.updated_at) > new Date(afterCreate!.updated_at)).toBe(true);

      // Excluir (soft delete)
      await expect(deleteShowById(client, id)).resolves.toMatchObject({ status: "success" });
      expect(await reload(user.email, "todos", venue)).toBeUndefined();
      expect(await reload(user.email, "excluidos", venue)).toMatchObject({ id, deleted_by: user.id });

      // Restaurar: mesmo registro volta para a agenda ativa
      await expect(restoreShowById(client, id)).resolves.toMatchObject({ status: "success" });
      expect(await reload(user.email, "excluidos", venue)).toBeUndefined();
      expect(await reload(user.email, "todos", venue)).toMatchObject({
        id,
        deleted_at: null,
        deleted_by: null,
        created_by: user.id,
      });
    },
    60_000,
  );

  it("visitante sem sessão não cria nem lista shows", async () => {
    const anon = newClient();
    const venue = `ZZ Teste anon ${RUN}`;
    venues.push(venue);
    const result = await createShowFromInput(anon, { showDate: "2026-10-05", showTime: "21:00", venueName: venue });
    expect(result.status).toBe("error");
    // `anon` não tem privilégio algum em `shows`: o banco recusa a consulta.
    await expect(listAgenda(anon, "todos")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("EDITOR não enxerga o financeiro", async () => {
    const editor = users.find((u) => u.role === "EDITOR")!;
    const client = newClient();
    await signIn(client, editor.email, PASSWORD);
    const { data } = await client.from("show_financial_entries").select("id");
    expect(data ?? []).toEqual([]);
  });
});
