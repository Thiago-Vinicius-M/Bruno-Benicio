// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, asUser, createTestDb, createUser, pgError, runAs } from "./support/testDb";

/** Agenda no site (migration 20261015120000_agenda_public_toggle.sql), direto no Postgres, como cada papel. */

let db: PGlite;
let editorId: string;
let inactiveId: string;

const publicSetting = async () => (await db.query("select * from public.get_public_agenda_settings()")).rows;

beforeAll(async () => {
  db = await createTestDb();
  await createUser(db, "admin@example.com", "ADMIN");
  editorId = await createUser(db, "editor@example.com", "EDITOR");
  inactiveId = await createUser(db, "inativo@example.com", "EDITOR");
  await db.query("update public.profiles set deactivated_at = now() where id = $1", [inactiveId]);
});

afterAll(async () => {
  await db?.close();
});

describe("agenda no site", () => {
  it("começa desabilitada: o site continua igual até o painel ligar", async () => {
    expect(await publicSetting()).toEqual([{ public_enabled: false }]);
  });

  it("anon lê só pela função; tabela fechada", async () => {
    await runAs(db, anon, async () => {
      expect(await publicSetting()).toEqual([{ public_enabled: false }]);
      expect((await pgError(db, "select * from public.agenda_settings")).code).toBe("42501");
      expect((await pgError(db, "update public.agenda_settings set public_enabled = true")).code).toBe("42501");
    });
  });

  it("staff habilita e desabilita; autoria pela sessão", async () => {
    await runAs(db, asUser(editorId), async () => {
      await db.query("update public.agenda_settings set public_enabled = true, updated_by = null");
      const { rows } = await db.query("select public_enabled, updated_by from public.agenda_settings");
      expect(rows[0]).toEqual({ public_enabled: true, updated_by: editorId });
      expect(await publicSetting()).toEqual([{ public_enabled: true }]);

      await db.query("update public.agenda_settings set public_enabled = false");
      expect(await publicSetting()).toEqual([{ public_enabled: false }]);
    });
  });

  it("uma linha só (sem criar nem apagar); usuário desativado não altera", async () => {
    await runAs(db, asUser(editorId), async () => {
      expect((await pgError(db, "insert into public.agenda_settings (id) values (true)")).code).toBe("42501");
      expect((await pgError(db, "delete from public.agenda_settings")).code).toBe("42501");
    });
    await runAs(db, asUser(inactiveId), async () => {
      expect((await db.query("select * from public.agenda_settings")).rows).toHaveLength(0);
      await db.query("update public.agenda_settings set public_enabled = true");
    });
    expect(await publicSetting()).toEqual([{ public_enabled: false }]);
  });
});
