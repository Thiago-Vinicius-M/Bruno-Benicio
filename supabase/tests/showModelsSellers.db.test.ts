// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, asUser, createTestDb, createUser, pgError, runAs, superuser } from "./support/testDb";

/**
 * Modelos de show e vendedores (migrations 20261012120000_show_models_sellers.sql e
 * 20261013120000_commercial_prices_video_placement.sql), direto no Postgres, como cada papel.
 */

let db: PGlite;
let adminId: string;
let editorId: string;
let inactiveAdminId: string;
let outsiderId: string;

const PHONE = "5562999998888";

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

const insertSeller = async (name = "Carlos", whatsapp = PHONE) =>
  (
    await db.query<{ id: string; code: string; created_by: string | null }>(
      "insert into public.sellers (name, whatsapp) values ($1, $2) returning id, code, created_by",
      [name, whatsapp],
    )
  ).rows[0];

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

  it("nenhum vendedor é criado pela migration (não há números a inventar)", async () => {
    expect((await db.query("select 1 from public.sellers")).rows).toHaveLength(0);
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
      expect((await pgError(db, "select * from public.sellers")).code).toBe("42501");
      expect((await pgError(db, "update public.show_models set price = 1")).code).toBe("42501");
      expect((await pgError(db, "insert into public.sellers (name, whatsapp) values ('x', $1)", [PHONE])).code).toBe(
        "42501",
      );
      expect((await pgError(db, "select public.move_show_model(gen_random_uuid(), 'up')")).code).toBe("42501");
    });
  });

  it("get_commercial_show_models: preços só com o código de um vendedor ativo", async () => {
    await runAs(db, superuser, async () => {
      const active = await insertSeller("Comercial", PHONE);
      const inactive = await insertSeller("Desligado", "5562977776666");
      await db.query("update public.sellers set active = false where id = $1", [inactive.id]);
      await db.query("update public.show_models set active = false where name = 'Voz, violão e bateria'");
      await actAnon();

      const commercial = async (code: string | null) =>
        (
          await db.query<{ name: string; price: string }>("select * from public.get_commercial_show_models($1)", [code])
        ).rows.map((row) => ({ name: row.name, price: Number(row.price) }));

      // Mesmos modelos ativos e ordem da versão pública, agora com o valor.
      expect(await commercial(active.code)).toEqual([
        { name: "Voz e violão", price: 1500 },
        { name: "Voz, violão, sanfona e bateria", price: 2200 },
        { name: "Bruno e Benício e banda", price: 3000 },
      ]);
      expect(await commercial(` ${active.code.toUpperCase()} `)).toHaveLength(3);
      // Vendedor desativado, código inexistente, vazio ou nulo: nada.
      for (const code of [inactive.code, "naoexiste000", "", null]) {
        expect(await commercial(code), String(code)).toEqual([]);
      }
    });
  });

  it("get_seller_link: ativo devolve o WhatsApp; inativo só o status; inexistente nada", async () => {
    await runAs(db, superuser, async () => {
      const active = await insertSeller("Ativo", PHONE);
      const inactive = await insertSeller("Inativo", "5562988887777");
      await db.query("update public.sellers set active = false where id = $1", [inactive.id]);
      await actAnon();

      const link = async (code: string) => (await db.query("select * from public.get_seller_link($1)", [code])).rows;
      expect(await link(active.code)).toEqual([{ active: true, whatsapp: PHONE }]);
      expect(await link(` ${active.code.toUpperCase()} `)).toEqual([{ active: true, whatsapp: PHONE }]);
      expect(await link(inactive.code)).toEqual([{ active: false, whatsapp: null }]);
      expect(await link("naoexiste000")).toEqual([]);
      expect(await link("")).toEqual([]);
    });
  });
});

describe("permissões do painel", () => {
  it("EDITOR, ADMIN desativado e usuário sem perfil não leem nem escrevem", async () => {
    for (const userId of [editorId, inactiveAdminId, outsiderId]) {
      await runAs(db, asUser(userId), async () => {
        expect((await db.query("select * from public.show_models")).rows).toHaveLength(0);
        expect((await db.query("select * from public.sellers")).rows).toHaveLength(0);
        const insertModel = await pgError(
          db,
          "insert into public.show_models (name, duration, price) values ('x', '1h', 10)",
        );
        expect(insertModel.code).toBe("42501");
        expect((await pgError(db, "insert into public.sellers (name, whatsapp) values ('x', $1)", [PHONE])).code).toBe(
          "42501",
        );
        // UPDATE sob RLS sem linhas visíveis não altera nada.
        await db.query("update public.show_models set price = 1");
      });
    }
    expect((await publicModels()).map((model) => model.price)).toEqual([1500, 1800, 2200, 3000]);
  });

  it("ninguém exclui fisicamente (desativar preserva o histórico)", async () => {
    await runAs(db, asUser(adminId), async () => {
      expect((await pgError(db, "delete from public.show_models")).code).toBe("42501");
      expect((await pgError(db, "delete from public.sellers")).code).toBe("42501");
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

  it("vendedor alterando o WhatsApp: o mesmo link continua liberando os valores", async () => {
    await runAs(db, asUser(adminId), async () => {
      const seller = await insertSeller("Troca", PHONE);
      await db.query("update public.sellers set whatsapp = '5511987654321' where id = $1", [seller.id]);
      expect((await db.query("select * from public.get_seller_link($1)", [seller.code])).rows).toEqual([
        { active: true, whatsapp: "5511987654321" },
      ]);
      expect((await db.query("select 1 from public.get_commercial_show_models($1)", [seller.code])).rows.length).toBe(4);
    });
  });
});

describe("vendedores (ADMIN)", () => {
  it("cadastro gera código único e aleatório; autoria pela sessão; código enviado é ignorado", async () => {
    await runAs(db, asUser(adminId), async () => {
      const a = await insertSeller("Ana", PHONE);
      const b = await insertSeller("Bia", "5562988887777");
      expect(a.code).toMatch(/^[0-9a-f]{12}$/);
      expect(b.code).not.toBe(a.code);
      expect(a.code).not.toContain("99998888");
      expect(a.created_by).toBe(adminId);

      const forged = await db.query<{ code: string }>(
        "insert into public.sellers (name, whatsapp, code) values ('C', $1, 'escolhido123') returning code",
        [PHONE],
      );
      expect(forged.rows[0].code).not.toBe("escolhido123");
    });
  });

  it("editar nome e número não muda o código do link (nem dá para trocá-lo)", async () => {
    await runAs(db, asUser(adminId), async () => {
      const seller = await insertSeller("Ana", PHONE);
      await db.query("update public.sellers set name = 'Ana Paula', whatsapp = '5511987654321', code = 'outro0000000' where id = $1", [
        seller.id,
      ]);
      const { rows } = await db.query<{ code: string; whatsapp: string; name: string }>(
        "select code, whatsapp, name from public.sellers where id = $1",
        [seller.id],
      );
      expect(rows[0]).toEqual({ code: seller.code, whatsapp: "5511987654321", name: "Ana Paula" });
    });
  });

  it("WhatsApp só em formato internacional normalizado (o banco repete a validação)", async () => {
    await runAs(db, asUser(adminId), async () => {
      const bad = (whatsapp: string) =>
        pgError(db, "insert into public.sellers (name, whatsapp) values ('x', $1)", [whatsapp]);
      for (const whatsapp of ["+5562999998888", "(62) 99999-8888", "62999998888x", "556299999888", "5562899998888", "0562999998888"]) {
        expect((await bad(whatsapp)).code, whatsapp).toBe("23514");
      }
      await insertSeller("Fixo", "556232223333");
      await insertSeller("Portugal", "351912345678");
    });
  });

  it("desativar invalida o link; reativar volta a funcionar com o mesmo código", async () => {
    await runAs(db, asUser(adminId), async () => {
      const seller = await insertSeller("Ana", PHONE);
      await db.query("update public.sellers set active = false where id = $1", [seller.id]);
      expect((await db.query("select * from public.get_seller_link($1)", [seller.code])).rows).toEqual([
        { active: false, whatsapp: null },
      ]);
      await db.query("update public.sellers set active = true where id = $1", [seller.id]);
      expect((await db.query("select * from public.get_seller_link($1)", [seller.code])).rows).toEqual([
        { active: true, whatsapp: PHONE },
      ]);
    });
  });
});

/** Dentro de uma transação já aberta por runAs: passa a agir como anon. */
async function actAnon() {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', '', true)");
  await db.exec(`set local role ${anon.role}`);
}
