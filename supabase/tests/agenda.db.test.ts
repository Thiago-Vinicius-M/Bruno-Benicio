// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actAs, anon, asUser, createTestDb, createUser, pgError, runAs, superuser } from "./support/testDb";

/**
 * Testes de segurança/integridade executados DIRETAMENTE no Postgres, com a
 * migration real. Nada aqui passa pela UI ou pelos repositórios TypeScript:
 * é o que um usuário conseguiria fazendo requisições manuais à API do Supabase.
 */

let db: PGlite;
let adminId: string;
let editorId: string;
let inactiveEditorId: string;
let noProfileId: string;
let show1: string; // 10/09/2026, com entradas financeiras
let show2: string; // 20/09/2026, cachê zero
let deletedShow: string; // 15/09/2026, excluído logicamente

const count = async (sql: string, params: unknown[] = []) =>
  (await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) t`, params)).rows[0].n;

beforeAll(async () => {
  db = await createTestDb();
  adminId = await createUser(db, "admin@example.com", "ADMIN");
  editorId = await createUser(db, "editor@example.com", "EDITOR");
  inactiveEditorId = await createUser(db, "inativo@example.com", "EDITOR");
  noProfileId = await createUser(db, "cadastro-aberto@example.com");
  await db.query("update public.profiles set deactivated_at = now() where id = $1", [inactiveEditorId]);

  const insertShow = async (date: string, venue: string) =>
    (
      await db.query<{ id: string }>(
        `insert into public.shows (show_date, show_time, venue_name, venue_instagram, created_by)
         values ($1, '21:00', $2, 'casaexemplo', $3) returning id`,
        [date, venue, adminId],
      )
    ).rows[0].id;
  show1 = await insertShow("2026-09-10", "Bar do Centro");
  show2 = await insertShow("2026-09-20", "Casa Aberta");
  deletedShow = await insertShow("2026-09-15", "Show Cancelado");

  const entry = (showId: string, type: string, description: string | null, amount: number) =>
    db.query(
      `insert into public.show_financial_entries (show_id, type, description, amount, created_by)
       values ($1, $2, $3, $4, $5)`,
      [showId, type, description, amount, adminId],
    );
  await entry(show1, "CACHE", null, 2000);
  await entry(show1, "OTHER_REVENUE", "Venda de bebidas", 500);
  await entry(show1, "OTHER_REVENUE", "Gorjeta", 100);
  await entry(show1, "EXPENSE", "Comissão", 50);
  await entry(show2, "CACHE", null, 0);
  await entry(deletedShow, "CACHE", null, 999);
  await db.query("update public.shows set deleted_at = now(), deleted_by = $2 where id = $1", [
    deletedShow,
    editorId,
  ]);
});

afterAll(async () => {
  await db?.close();
});

describe("segurança financeira (RLS)", () => {
  it("ADMIN consegue ler as entradas financeiras", async () => {
    await runAs(db, asUser(adminId), async () => {
      expect(await count("select * from public.show_financial_entries")).toBe(6);
    });
  });

  it("EDITOR não enxerga nenhuma entrada financeira, nem via join com shows", async () => {
    await runAs(db, asUser(editorId), async () => {
      expect(await count("select * from public.show_financial_entries")).toBe(0);
      expect(await count("select amount from public.show_financial_entries where show_id = $1", [show1])).toBe(0);
      expect(
        await count(
          `select e.amount from public.shows s join public.show_financial_entries e on e.show_id = s.id`,
        ),
      ).toBe(0);
    });
  });

  it("EDITOR não consegue criar, editar nem excluir entradas financeiras", async () => {
    await runAs(db, asUser(editorId), async () => {
      const insert = await pgError(
        db,
        `insert into public.show_financial_entries (show_id, type, amount, created_by, updated_by)
         values ($1, 'CACHE', 1, $2, $2)`,
        [show1, editorId],
      );
      expect(insert.code).toBe("42501");

      const update = await db.query("update public.show_financial_entries set amount = 0");
      expect(update.affectedRows).toBe(0);
      const del = await db.query("delete from public.show_financial_entries");
      expect(del.affectedRows).toBe(0);

      expect((await pgError(db, "truncate public.show_financial_entries")).code).toBe("42501");
    });
    // Nada mudou de fato.
    expect(await count("select * from public.show_financial_entries where amount = 2000")).toBe(1);
  });

  it("EDITOR não consegue gerar relatório financeiro", async () => {
    await runAs(db, asUser(editorId), async () => {
      const error = await pgError(db, "select * from public.get_financial_report('2026-01-01', '2026-12-31')");
      expect(error.code).toBe("42501");
    });
  });

  it("anônimo não tem acesso a nenhuma tabela nem ao relatório", async () => {
    await runAs(db, anon, async () => {
      for (const table of ["show_financial_entries", "shows", "profiles"]) {
        expect((await pgError(db, `select * from public.${table}`)).code).toBe("42501");
      }
      expect(
        (await pgError(db, "select * from public.get_financial_report('2026-01-01', '2026-12-31')")).code,
      ).toBe("42501");
    });
  });

  it("ADMIN desativado perde acesso ao financeiro imediatamente", async () => {
    await runAs(db, superuser, async () => {
      const otherAdmin = await createUser(db, "admin2@example.com", "ADMIN");
      await actAs(db, asUser(otherAdmin));
      expect(await count("select * from public.show_financial_entries")).toBe(6);

      await actAs(db, asUser(adminId));
      await db.query("update public.profiles set deactivated_at = now() where id = $1", [otherAdmin]);
      await actAs(db, asUser(otherAdmin));
      expect(await count("select * from public.show_financial_entries")).toBe(0);
    });
  });
});

describe("autorização de shows e usuários", () => {
  it("usuário autenticado sem perfil (cadastro aberto) ou desativado não acessa nada", async () => {
    for (const userId of [noProfileId, inactiveEditorId]) {
      await runAs(db, asUser(userId), async () => {
        expect(await count("select * from public.shows")).toBe(0);
        const insert = await pgError(
          db,
          "insert into public.shows (show_date, show_time, venue_name) values ('2026-09-01', '20:00', 'X')",
        );
        expect(insert.code).toBe("42501");
      });
    }
  });

  it("EDITOR não consegue criar usuário (perfil)", async () => {
    const newUser = await createUser(db, "novo@example.com");
    await runAs(db, asUser(editorId), async () => {
      const error = await pgError(
        db,
        "insert into public.profiles (id, name, role) values ($1, 'Novo', 'ADMIN')",
        [newUser],
      );
      expect(error.code).toBe("42501");
    });
  });

  it("EDITOR não consegue alterar o próprio papel nem o de outros", async () => {
    await runAs(db, asUser(editorId), async () => {
      // O RLS (UPDATE só para ADMIN) filtra a linha antes do trigger: nada é alterado.
      const own = await db.query("update public.profiles set role = 'ADMIN' where id = $1", [editorId]);
      expect(own.affectedRows).toBe(0);

      const other = await db.query("update public.profiles set role = 'EDITOR' where id = $1", [adminId]);
      expect(other.affectedRows).toBe(0);

      // Nem o próprio nome: edição de perfis é exclusiva de ADMIN.
      const rename = await db.query("update public.profiles set name = 'Outro' where id = $1", [editorId]);
      expect(rename.affectedRows).toBe(0);
    });
    const { rows } = await db.query<{ name: string; role: string }>(
      "select name, role from public.profiles where id = $1",
      [editorId],
    );
    expect(rows[0]).toEqual({ name: "editor", role: "EDITOR" });
  });

  it("EDITOR lê só o próprio perfil; ADMIN lê todos", async () => {
    await runAs(db, asUser(editorId), async () => {
      const { rows } = await db.query<{ id: string }>("select id from public.profiles");
      expect(rows.map((r) => r.id)).toEqual([editorId]);
    });
    await runAs(db, asUser(adminId), async () => {
      // admin, editor e inativo (a conta sem perfil não tem linha em profiles).
      expect(await count("select * from public.profiles")).toBe(3);
    });
  });

  it("desativado ainda lê o próprio perfil (para a aplicação saber o motivo), mas nenhum outro", async () => {
    await runAs(db, asUser(inactiveEditorId), async () => {
      const { rows } = await db.query<{ id: string }>("select id from public.profiles");
      expect(rows.map((r) => r.id)).toEqual([inactiveEditorId]);
    });
  });

  it("get_team_names: staff recebe só id e nome; sem perfil ativo, nada", async () => {
    await runAs(db, asUser(editorId), async () => {
      const { rows, fields } = await db.query<{ id: string; name: string }>("select * from public.get_team_names()");
      expect(fields.map((f) => f.name)).toEqual(["id", "name"]);
      expect(rows.map((r) => r.id)).toContain(adminId);
    });
    for (const userId of [inactiveEditorId, noProfileId]) {
      await runAs(db, asUser(userId), async () => {
        expect(await count("select * from public.get_team_names()")).toBe(0);
      });
    }
    await runAs(db, anon, async () => {
      expect((await pgError(db, "select * from public.get_team_names()")).code).toBe("42501");
    });
  });

  it("escalada de privilégio: EDITOR não se promove, não promove outros nem altera status", async () => {
    // Tudo numa transação desfeita no final (nada vaza para os outros testes).
    await runAs(db, superuser, async () => {
      const other = await createUser(db, "outro-editor@example.com", "EDITOR");
      const fresh = await createUser(db, "cadastro@example.com");
      await actAs(db, asUser(editorId));

      // Não enxerga nem consegue atualizar perfis alheios (0 linhas).
      for (const sql of [
        "update public.profiles set role = 'ADMIN' where id = $1",
        "update public.profiles set deactivated_at = now() where id = $1",
      ]) {
        expect((await db.query(sql, [other])).affectedRows).toBe(0);
        expect((await db.query(sql.replace("$1", `'${adminId}'`))).affectedRows).toBe(0);
      }
      // O próprio perfil: nem papel nem status.
      for (const sql of [
        "update public.profiles set role = 'ADMIN' where id = $1",
        "update public.profiles set deactivated_at = null, role = 'ADMIN' where id = $1",
      ]) {
        const result = await db.query(sql, [editorId]).catch((e) => e);
        expect(result.affectedRows ?? 0).toBe(0);
      }
      // Nem cria um perfil ADMIN para uma conta nova.
      expect((await pgError(db, "insert into public.profiles (id, name, role) values ($1, 'X', 'ADMIN')", [fresh])).code).toBe(
        "42501",
      );

      await actAs(db, superuser);
      const { rows } = await db.query<{ role: string; active: boolean }>(
        "select role, deactivated_at is null as active from public.profiles where id = any($1) order by role",
        [[editorId, other, adminId]],
      );
      expect(rows).toEqual([
        { role: "ADMIN", active: true },
        { role: "EDITOR", active: true },
        { role: "EDITOR", active: true },
      ]);
    });
  });

  it("ADMIN convida (cria perfil) com autoria registrada; created_by é imutável", async () => {
    const invited = await createUser(db, "convidado@example.com");
    await runAs(db, asUser(adminId), async () => {
      const { rows } = await db.query<Record<string, unknown>>(
        `insert into public.profiles (id, name, role, created_by, updated_by, deactivated_at)
         values ($1, ' Convidado ', 'EDITOR', $2, $2, now())
         returning name, created_by, updated_by, deactivated_at`,
        [invited, editorId],
      );
      expect(rows[0]).toEqual({ name: "Convidado", created_by: adminId, updated_by: adminId, deactivated_at: null });

      await db.query("update public.profiles set name = 'Convidado 2', created_by = $2 where id = $1", [
        invited,
        editorId,
      ]);
      const after = await db.query<Record<string, unknown>>(
        "select created_by, updated_by from public.profiles where id = $1",
        [invited],
      );
      expect(after.rows[0]).toEqual({ created_by: adminId, updated_by: adminId });
    });
  });

  it("ADMIN altera papéis e desativa usuários, com autoria registrada", async () => {
    await runAs(db, asUser(adminId), async () => {
      await db.query("update public.profiles set role = 'ADMIN' where id = $1", [editorId]);
      await db.query("update public.profiles set deactivated_at = '2000-01-01' where id = $1", [
        inactiveEditorId,
      ]);
      await db.query("update public.profiles set deactivated_at = now() where id = $1", [editorId]);
      const { rows } = await db.query<{ role: string; deactivated_by: string; recent: boolean }>(
        `select role, deactivated_by, deactivated_at > now() - interval '1 minute' as recent
         from public.profiles where id = $1`,
        [editorId],
      );
      expect(rows[0]).toEqual({ role: "ADMIN", deactivated_by: adminId, recent: true });
    });
  });

  it("ADMIN não remove o próprio acesso (nem rebaixando, nem desativando)", async () => {
    await runAs(db, asUser(adminId), async () => {
      const demote = await pgError(db, "update public.profiles set role = 'EDITOR' where id = $1", [adminId]);
      expect(demote).toMatchObject({ code: "AG004", message: "Você não pode remover o próprio acesso administrativo." });
      const deactivate = await pgError(db, "update public.profiles set deactivated_at = now() where id = $1", [
        adminId,
      ]);
      expect(deactivate.code).toBe("AG004");
      // Editar o próprio nome continua permitido.
      await db.query("update public.profiles set name = 'admin' where id = $1", [adminId]);
    });
  });

  it("ADMIN rebaixa outro ADMIN quando ainda resta um ADMIN ativo", async () => {
    await runAs(db, superuser, async () => {
      const second = await createUser(db, "segundo-admin@example.com", "ADMIN");
      await actAs(db, asUser(adminId));
      const { rows } = await db.query<{ role: string; updated_by: string }>(
        "update public.profiles set role = 'EDITOR' where id = $1 returning role, updated_by",
        [second],
      );
      expect(rows[0]).toEqual({ role: "EDITOR", updated_by: adminId });
    });
  });

  it("nunca deixa o sistema sem ADMIN ativo, nem por fora da aplicação (SQL Editor)", async () => {
    await runAs(db, superuser, async () => {
      const demote = await pgError(db, "update public.profiles set role = 'EDITOR' where id = $1", [adminId]);
      expect(demote).toMatchObject({ code: "AG003", message: "Não é possível remover o último administrador ativo." });
      const deactivate = await pgError(db, "update public.profiles set deactivated_at = now() where id = $1", [
        adminId,
      ]);
      expect(deactivate.code).toBe("AG003");
    });
  });

  it("excluir no Auth um usuário com histórico de auditoria é bloqueado; sem histórico é permitido", async () => {
    await runAs(db, superuser, async () => {
      const withHistory = await pgError(db, "delete from auth.users where id = $1", [editorId]);
      expect(withHistory.code).toBe("23001"); // restrict_violation

      const clean = await createUser(db, "sem-historico@example.com", "EDITOR");
      await db.query("delete from auth.users where id = $1", [clean]);
      expect(await count("select * from public.profiles where id = $1", [clean])).toBe(0);
    });
  });
});

describe("shows: CRUD, auditoria e soft delete", () => {
  it("EDITOR cria show; autoria vem da sessão, não do payload", async () => {
    await runAs(db, asUser(editorId), async () => {
      const { rows } = await db.query<Record<string, unknown>>(
        `insert into public.shows
           (show_date, show_time, venue_name, venue_instagram, created_by, updated_by, deleted_at, deleted_by)
         values ('2026-09-25', '22:30', '  Casa Nova ', '@CasaNova', $1, $1, now(), $1)
         returning venue_name, venue_instagram, created_by, updated_by, deleted_at, deleted_by`,
        [adminId],
      );
      expect(rows[0]).toEqual({
        venue_name: "Casa Nova",
        venue_instagram: "casanova",
        created_by: editorId,
        updated_by: editorId,
        deleted_at: null,
        deleted_by: null,
      });
    });
  });

  it("EDITOR edita show; updated_by muda e created_by é imutável", async () => {
    await runAs(db, asUser(editorId), async () => {
      const { rows } = await db.query<Record<string, unknown>>(
        `update public.shows set venue_name = 'Bar do Centro (novo)', created_by = $2, updated_by = $2
         where id = $1 returning venue_name, created_by, updated_by`,
        [show1, editorId],
      );
      expect(rows[0]).toEqual({ venue_name: "Bar do Centro (novo)", created_by: adminId, updated_by: editorId });
    });
  });

  it("EDITOR exclui logicamente; registro permanece com deleted_by e deleted_at do servidor", async () => {
    await runAs(db, asUser(editorId), async () => {
      await db.query("update public.shows set deleted_at = '2000-01-01', deleted_by = $2 where id = $1", [
        show2,
        adminId,
      ]);
      const { rows } = await db.query<Record<string, unknown>>(
        `select deleted_by, deleted_at > now() - interval '1 minute' as recent
         from public.shows where id = $1`,
        [show2],
      );
      expect(rows[0]).toEqual({ deleted_by: editorId, recent: true });

      const active = await db.query<{ id: string }>("select id from public.shows where deleted_at is null");
      expect(active.rows.map((r) => r.id)).toEqual([show1]);
      // Histórico: os excluídos continuam consultáveis pelo painel.
      expect(await count("select * from public.shows where deleted_at is not null")).toBe(2);
    });
  });

  it("DELETE físico de shows é negado", async () => {
    await runAs(db, asUser(adminId), async () => {
      expect((await pgError(db, "delete from public.shows where id = $1", [show1])).code).toBe("42501");
    });
  });

  it("show excluído não pode ser editado, mas pode ser restaurado", async () => {
    await runAs(db, asUser(editorId), async () => {
      const edit = await pgError(db, "update public.shows set venue_name = 'X' where id = $1", [deletedShow]);
      expect(edit.code).toBe("AG001");

      const { rows } = await db.query<Record<string, unknown>>(
        "update public.shows set deleted_at = null where id = $1 returning deleted_at, deleted_by, updated_by",
        [deletedShow],
      );
      expect(rows[0]).toEqual({ deleted_at: null, deleted_by: null, updated_by: editorId });
    });
  });

  it("ADMIN faz o ciclo completo: cria, edita, exclui e restaura, com autoria registrada", async () => {
    await runAs(db, asUser(adminId), async () => {
      const created = await db.query<{ id: string; show_date: string; show_time: string }>(
        `insert into public.shows (show_date, show_time, venue_name)
         values ('2026-10-05', '21:30', 'Villa Mix') returning id, show_date::text, show_time::text`,
      );
      const { id } = created.rows[0];
      // Data de calendário e horário de parede: gravados exatamente como enviados.
      expect(created.rows[0]).toMatchObject({ show_date: "2026-10-05", show_time: "21:30:00" });

      await db.query("update public.shows set show_time = '22:00', venue_instagram = 'villamix' where id = $1", [id]);
      await db.query("update public.shows set deleted_at = now() where id = $1", [id]);
      const deleted = await db.query<Record<string, unknown>>(
        "select deleted_by, deleted_at is not null as deleted from public.shows where id = $1",
        [id],
      );
      expect(deleted.rows[0]).toEqual({ deleted_by: adminId, deleted: true });
      expect(await count("select * from public.shows where deleted_at is null and id = $1", [id])).toBe(0);

      await db.query("update public.shows set deleted_at = null where id = $1", [id]);
      const restored = await db.query<Record<string, unknown>>(
        `select show_time::text, venue_instagram, created_by, updated_by, deleted_at, deleted_by
         from public.shows where id = $1 and deleted_at is null`,
        [id],
      );
      expect(restored.rows[0]).toEqual({
        show_time: "22:00:00",
        venue_instagram: "villamix",
        created_by: adminId,
        updated_by: adminId,
        deleted_at: null,
        deleted_by: null,
      });
      // Restaurar não cria outro registro.
      expect(await count("select * from public.shows where venue_name = 'Villa Mix'")).toBe(1);
    });
  });

  it("anônimo não cria, não edita, não exclui nem restaura shows", async () => {
    await runAs(db, anon, async () => {
      const insert = await pgError(
        db,
        "insert into public.shows (show_date, show_time, venue_name) values ('2026-10-05', '21:00', 'Bar')",
      );
      expect(insert.code).toBe("42501");
      const update = await pgError(db, "update public.shows set deleted_at = null where id = $1", [deletedShow]);
      expect(update.code).toBe("42501");
    });
  });

  it("constraints: local obrigatório, data obrigatória e Instagram só como username", async () => {
    await runAs(db, asUser(editorId), async () => {
      const blank = await pgError(
        db,
        "insert into public.shows (show_date, show_time, venue_name) values ('2026-09-01', '20:00', '   ')",
      );
      expect(blank.code).toBe("23514");
      const noDate = await pgError(
        db,
        "insert into public.shows (show_date, show_time, venue_name) values (null, '20:00', 'Bar')",
      );
      expect(noDate.code).toBe("23502");
      const noTime = await pgError(
        db,
        "insert into public.shows (show_date, show_time, venue_name) values ('2026-09-01', null, 'Bar')",
      );
      expect(noTime.code).toBe("23502");
      const url = await pgError(
        db,
        `insert into public.shows (show_date, show_time, venue_name, venue_instagram)
         values ('2026-09-01', '20:00', 'Bar', 'https://instagram.com/bar')`,
      );
      expect(url.code).toBe("23514");
    });
  });
});

describe("agenda pública", () => {
  it("anônimo recebe só colunas públicas de shows ativos do intervalo", async () => {
    await runAs(db, anon, async () => {
      const { rows, fields } = await db.query<{ venue_name: string }>(
        "select * from public.get_public_agenda('2026-09-01', '2026-09-30')",
      );
      expect(fields.map((f) => f.name)).toEqual(["id", "show_date", "show_time", "venue_name", "venue_instagram"]);
      expect(rows.map((r) => r.venue_name)).toEqual(["Bar do Centro", "Casa Aberta"]);
    });
  });

  it("filtra pelo intervalo pedido (outro mês não aparece)", async () => {
    await runAs(db, anon, async () => {
      expect(await count("select * from public.get_public_agenda('2026-10-01', '2026-10-31')")).toBe(0);
    });
  });

  it("rejeita intervalos inválidos", async () => {
    await runAs(db, anon, async () => {
      expect((await pgError(db, "select * from public.get_public_agenda('2026-09-30', '2026-09-01')")).code).toBe(
        "22023",
      );
    });
  });
});

describe("financeiro: lançamentos e agregações", () => {
  it("ADMIN lança múltiplas entradas e valor zero; negativo é rejeitado; autoria vem da sessão", async () => {
    await runAs(db, asUser(adminId), async () => {
      const { rows } = await db.query<{ created_by: string; description: string | null }>(
        `insert into public.show_financial_entries (show_id, type, description, amount, created_by)
         values ($1, 'OTHER_REVENUE', '  ', 0, $2) returning created_by, description`,
        [show2, editorId],
      );
      expect(rows[0]).toEqual({ created_by: adminId, description: null });
      expect(await count("select * from public.show_financial_entries where show_id = $1", [show2])).toBe(2);

      const negative = await pgError(
        db,
        "insert into public.show_financial_entries (show_id, type, amount) values ($1, 'EXPENSE', -50)",
        [show1],
      );
      expect(negative.code).toBe("23514");
    });
  });

  it("não aceita lançamento em show excluído", async () => {
    await runAs(db, asUser(adminId), async () => {
      const error = await pgError(
        db,
        "insert into public.show_financial_entries (show_id, type, amount) values ($1, 'CACHE', 10)",
        [deletedShow],
      );
      expect(error.code).toBe("AG002");
    });
  });

  it("relatório mensal soma cachês, receitas e despesas (despesa subtrai) e ignora shows excluídos", async () => {
    await runAs(db, asUser(adminId), async () => {
      const { rows } = await db.query<Record<string, unknown>>(
        `select period_start::text, show_count::int, entry_count::int, cache_total::text,
                other_revenue_total::text, expense_total::text, net_total::text
         from public.get_financial_report('2026-09-01', '2026-09-30', 'month')`,
      );
      expect(rows).toEqual([
        {
          period_start: "2026-09-01",
          show_count: 2,
          entry_count: 5,
          cache_total: "2000.00",
          other_revenue_total: "600.00",
          expense_total: "50.00",
          net_total: "2550.00",
        },
      ]);
    });
  });

  it("relatório semanal (semana ISO) e anual", async () => {
    await runAs(db, asUser(adminId), async () => {
      const weekly = await db.query<{ period_start: string; net_total: string }>(
        `select period_start::text, net_total::text
         from public.get_financial_report('2026-09-01', '2026-09-30', 'week')`,
      );
      expect(weekly.rows).toEqual([
        { period_start: "2026-09-07", net_total: "2550.00" },
        { period_start: "2026-09-14", net_total: "0.00" },
      ]);

      const yearly = await db.query<{ period_start: string; net_total: string }>(
        `select period_start::text, net_total::text
         from public.get_financial_report('2026-01-01', '2026-12-31', 'year')`,
      );
      expect(yearly.rows).toEqual([{ period_start: "2026-01-01", net_total: "2550.00" }]);

      const invalid = await pgError(db, "select * from public.get_financial_report('2026-01-01', '2026-12-31', 'decade')");
      expect(invalid.code).toBe("22023");
    });
  });
});
