// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, asUser, createTestDb, createUser, pgError, runAs, superuser } from "./support/testDb";

/**
 * Modelos de show (migrations 20261012120000_show_models_sellers.sql e
 * 20261013120000_commercial_prices_video_placement.sql), direto no Postgres, como cada papel.
 * Os vendedores antigos foram removidos (20261018120300); links: sellerLinks.db.test.ts.
 */

let db: PGlite;
let adminId: string;
let editorId: string;
let inactiveAdminId: string;
let outsiderId: string;

/** Modelos ativos com valor, na ordem do site (o que a versão comercial mostra). */
const publicModels = async () =>
  (
    await db.query<{ name: string; duration: string; description: string | null; price: string }>(
      "select name, duration, description, price from public.show_models where active order by position, created_at, id",
    )
  ).rows.map((row) => ({ ...row, price: Number(row.price) }));

const modelNames = async () =>
  (await db.query<{ name: string }>("select name from public.show_models order by position")).rows.map((row) => row.name);

const modelId = async (name: string) =>
  (await db.query<{ id: string }>("select id from public.show_models where name = $1", [name])).rows[0].id;

beforeAll(async () => {
  db = await createTestDb();
  adminId = await createUser(db, "admin@example.com", "ADMIN");
  editorId = await createUser(db, "editor@example.com", "EDITOR");
  inactiveAdminId = await createUser(db, "inativo@example.com", "ADMIN");
  await db.query("update public.profiles set deactivated_at = now() where id = $1", [inactiveAdminId]);
  outsiderId = await createUser(db, "sem-perfil@example.com");
});

afterAll(async () => {
  await db?.close();
});

describe("modelos importados do site", () => {
  it("os 4 formatos de showContent.ts, com duração, valor e ordem preservados", async () => {
    expect(await publicModels()).toEqual([
      expect.objectContaining({ name: "Voz e violão", duration: "2h30 de show", description: null, price: 1500 }),
      expect.objectContaining({ name: "Voz, violão e bateria", duration: "2h30 de show", price: 1800 }),
      expect.objectContaining({ name: "Voz, violão, sanfona e bateria", duration: "2h30 de show", price: 2200 }),
      expect.objectContaining({ name: "Bruno e Benício e banda", duration: "2h30 de show", price: 3000 }),
    ]);
  });

  it("o seed é idempotente: rodar de novo não duplica nem desfaz edições do painel", async () => {
    const migration = readFileSync(
      fileURLToPath(new URL("../migrations/20261012120000_show_models_sellers.sql", import.meta.url)),
      "utf8",
    );
    const seed = migration.slice(migration.indexOf("insert into public.show_models (name, duration, price)"));
    await runAs(db, superuser, async () => {
      await db.query("update public.show_models set price = 1999 where name = 'Voz e violão'");
      await db.exec(seed);
      expect(await modelNames()).toHaveLength(4);
      expect((await publicModels())[0].price).toBe(1999);
    });
  });

});

describe("site público (anon)", () => {
  it("lê só modelos ativos, só as colunas públicas e SEM preço, pela função; as tabelas são fechadas", async () => {
    await runAs(db, superuser, async () => {
      await db.query("update public.show_models set active = false where name = 'Voz e violão'");
      await actAnon();
      const { rows, fields } = await db.query<{ name: string }>("select * from public.get_public_show_models()");
      expect(rows.map((row) => row.name)).not.toContain("Voz e violão");
      expect(rows).toHaveLength(3);
      expect(fields.map((field) => field.name)).toEqual(["id", "name", "duration", "description"]);
      expect(JSON.stringify(rows)).not.toMatch(/price|1800|2200|3000/);
      expect((await pgError(db, "select price from public.show_models")).code).toBe("42501");
      expect((await pgError(db, "select * from public.show_models")).code).toBe("42501");
      expect((await pgError(db, "update public.show_models set price = 1")).code).toBe("42501");
      expect((await pgError(db, "select public.move_show_model(gen_random_uuid(), 'up')")).code).toBe("42501");
    });
  });

});

describe("permissões do painel", () => {
  it("EDITOR, ADMIN desativado e usuário sem perfil não leem nem escrevem", async () => {
    for (const userId of [editorId, inactiveAdminId, outsiderId]) {
      await runAs(db, asUser(userId), async () => {
        expect((await db.query("select * from public.show_models")).rows).toHaveLength(0);
        const insertModel = await pgError(
          db,
          "insert into public.show_models (name, duration, price) values ('x', '1h', 10)",
        );
        expect(insertModel.code).toBe("42501");
        // UPDATE sob RLS sem linhas visíveis não altera nada.
        await db.query("update public.show_models set price = 1");
      });
    }
    expect((await publicModels()).map((model) => model.price)).toEqual([1500, 1800, 2200, 3000]);
  });

  it("ninguém exclui fisicamente (desativar preserva o histórico)", async () => {
    await runAs(db, asUser(adminId), async () => {
      expect((await pgError(db, "delete from public.show_models")).code).toBe("42501");
    });
  });
});

describe("modelos de show (ADMIN)", () => {
  it("cria no fim da lista com autoria da sessão (valores de auditoria e posição enviados são ignorados)", async () => {
    await runAs(db, asUser(adminId), async () => {
      const { rows } = await db.query<{ created_by: string; position: number; name: string; description: string | null }>(
        `insert into public.show_models (name, duration, description, price, created_by, position)
         values ('  Acústico  ', '1h30 de show', '   ', 990.5, null, -3) returning created_by, position, name, description`,
      );
      expect(rows[0]).toEqual({ created_by: adminId, position: 5, name: "Acústico", description: null });
      expect((await modelNames()).at(-1)).toBe("Acústico");
    });
  });

  it("edita nome, descrição e preço; o site reflete na hora", async () => {
    await runAs(db, asUser(adminId), async () => {
      await db.query(
        "update public.show_models set name = 'Voz e violão (acústico)', description = 'Ideal para eventos menores', price = 1650.75 where name = 'Voz e violão'",
      );
      expect((await publicModels())[0]).toEqual(
        expect.objectContaining({
          name: "Voz e violão (acústico)",
          description: "Ideal para eventos menores",
          price: 1650.75,
        }),
      );
      const { rows } = await db.query<{ updated_by: string }>(
        "select updated_by from public.show_models where name = 'Voz e violão (acústico)'",
      );
      expect(rows[0].updated_by).toBe(adminId);
    });
  });

  it("desativar tira do site e reativar devolve, na mesma posição", async () => {
    await runAs(db, asUser(adminId), async () => {
      await db.query("update public.show_models set active = false where name = 'Voz, violão e bateria'");
      expect((await publicModels()).map((model) => model.name)).not.toContain("Voz, violão e bateria");
      await db.query("update public.show_models set active = true where name = 'Voz, violão e bateria'");
      expect((await publicModels())[1].name).toBe("Voz, violão e bateria");
    });
  });

  it("move_show_model troca posições; no topo não faz nada", async () => {
    await runAs(db, asUser(adminId), async () => {
      const band = await modelId("Bruno e Benício e banda");
      await db.query("select public.move_show_model($1, 'up')", [band]);
      expect(await modelNames()).toEqual([
        "Voz e violão",
        "Voz, violão e bateria",
        "Bruno e Benício e banda",
        "Voz, violão, sanfona e bateria",
      ]);
      const first = await modelId("Voz e violão");
      await db.query("select public.move_show_model($1, 'up')", [first]);
      expect((await modelNames())[0]).toBe("Voz e violão");
      expect((await pgError(db, "select public.move_show_model($1, 'sideways')", [first])).code).toBe("22023");
    });
  });

  it("valida nome, duração, preço e nome repetido (sem diferenciar maiúsculas)", async () => {
    await runAs(db, asUser(adminId), async () => {
      const bad = (name: string, duration: string, price: number) =>
        pgError(db, "insert into public.show_models (name, duration, price) values ($1, $2, $3)", [name, duration, price]);
      expect((await bad("  ", "1h", 10)).code).toBe("23514");
      expect((await bad("Novo", "", 10)).code).toBe("23514");
      expect((await bad("Novo", "1h", 0)).code).toBe("23514");
      expect((await bad("Novo", "1h", -5)).code).toBe("23514");
      expect((await bad("VOZ E VIOLÃO", "1h", 10)).code).toBe("23505");
    });
  });

  it("ordem determinística mesmo com o mesmo created_at", async () => {
    await runAs(db, asUser(adminId), async () => {
      const read = async () => (await db.query("select * from public.get_public_show_models()")).rows;
      expect(await read()).toEqual(await read());
    });
  });

});

/** Troca o papel da transação atual para anon (como o PostgREST faria). */
async function actAnon() {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', '', true)");
  await db.exec(`set local role ${anon.role}`);
}
