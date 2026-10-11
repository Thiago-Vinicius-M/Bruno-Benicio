// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, asUser, createTestDb, createUser, pgError, runAs, superuser } from "./support/testDb";

/**
 * Vídeos (migrations 20261011120000_videos.sql e 20261013120000_commercial_prices_video_placement.sql),
 * direto no Postgres, como cada papel.
 */

let db: PGlite;
let editorId: string;
let inactiveId: string;

const titles = async (placement: string) =>
  (
    await db.query<{ title: string }>("select title from public.videos where placement = $1 order by position", [
      placement,
    ])
  ).rows.map((row) => row.title);

const idOf = async (title: string) =>
  (await db.query<{ id: string }>("select id from public.videos where title = $1", [title])).rows[0].id;

const publicTitles = async () =>
  (await db.query<{ title: string; placement: string }>("select title, placement from public.get_public_videos()")).rows;

const insert = (title: string, placement: string, orientation = "landscape") =>
  db.query(
    "insert into public.videos (title, source_type, source, orientation, placement) values ($1, 'youtube', 'abcdefghijk', $2, $3)",
    [title, orientation, placement],
  );

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

describe("migração dos vídeos existentes", () => {
  it("os 7 vídeos preservados: os 3 da Home viram secundários (na ordem), os 4 do “Ver mais” ficam só na galeria", async () => {
    expect(await titles("secondary")).toEqual([
      "Conheça nosso show",
      "Foi Deus (AO VIVO)",
      "SÓ PRO MEU PRAZER (AO VIVO)",
    ]);
    expect(await titles("gallery")).toEqual([
      "POT-POURRI MANEIRA ERRADA / QUEM DE NOS DOIS",
      "AMIGO",
      "Só da você na minha vida",
      "Ela é demais",
    ]);
  });

  it("nenhum vira principal automaticamente; todos ativos; URLs e capas intactas", async () => {
    expect(await titles("main")).toEqual([]);
    expect((await db.query("select 1 from public.videos where not active")).rows).toHaveLength(0);
    const { rows } = await db.query<{ source: string; poster: string }>(
      "select source, poster from public.videos where title = 'Conheça nosso show'",
    );
    expect(rows[0]).toEqual({
      source: "/videos/BeB-conhec%CC%A7a-nosso-show.mp4",
      poster: "/videos/BeB-conhe%C3%A7a-nosso-showThumb.jpg",
    });
  });

  it("limites iniciais = comportamento anterior (3 no desktop e 3 no celular)", async () => {
    expect((await db.query("select * from public.get_public_video_settings()")).rows).toEqual([
      { home_limit_desktop: 3, home_limit_mobile: 3 },
    ]);
  });
});

describe("site público (anon)", () => {
  it("lê só pela função, só ativos, sem auditoria; tabelas fechadas e funções do painel negadas", async () => {
    await runAs(db, superuser, async () => {
      await db.query("update public.videos set active = false where title = 'AMIGO'");
      await db.exec("reset role");
      await db.exec(`set local role ${anon.role}`);

      const { rows, fields } = await db.query<{ title: string }>("select * from public.get_public_videos()");
      expect(rows).toHaveLength(6);
      expect(rows.map((row) => row.title)).not.toContain("AMIGO");
      expect(fields.map((field) => field.name)).toEqual([
        "id",
        "title",
        "source_type",
        "source",
        "poster",
        "orientation",
        "placement",
      ]);
      expect((await pgError(db, "select * from public.videos")).code).toBe("42501");
      expect((await pgError(db, "select * from public.video_settings")).code).toBe("42501");
      expect((await pgError(db, "update public.video_settings set home_limit_desktop = 12")).code).toBe("42501");
      expect((await pgError(db, "select public.move_video(gen_random_uuid(), 'up')")).code).toBe("42501");
      expect((await pgError(db, "select public.set_main_video(gen_random_uuid())")).code).toBe("42501");
    });
  });
});

describe("painel: cadastro e edição", () => {
  it("EDITOR cria: autoria pela sessão e posição no fim (valores enviados são ignorados)", async () => {
    await runAs(db, asUser(editorId), async () => {
      const { rows } = await db.query<{ created_by: string; position: number; placement: string; active: boolean }>(
        `insert into public.videos (title, source_type, source, orientation, created_by, position)
         values (' Novo ', 'youtube', 'abcdefghijk', 'landscape', null, -5) returning created_by, position, placement, active`,
      );
      expect(rows[0]).toEqual({ created_by: editorId, position: 8, placement: "secondary", active: true });
      expect(await titles("secondary")).toContain("Novo");
    });
  });

  it("edita título e orientação; classificação é independente da orientação", async () => {
    await runAs(db, asUser(editorId), async () => {
      await db.query(
        "update public.videos set title = 'Conheça (vertical)', placement = 'gallery' where title = 'Conheça nosso show'",
      );
      await insert("Horizontal principal", "main", "landscape");
      await db.query("update public.videos set orientation = 'portrait' where title = 'Horizontal principal'");
      const { rows } = await db.query("select orientation, placement from public.videos where title = 'Horizontal principal'");
      expect(rows[0]).toEqual({ orientation: "portrait", placement: "main" });
      // Quem mudou de classificação foi para o fim do novo grupo.
      expect((await titles("gallery")).at(-1)).toBe("Conheça (vertical)");
    });
  });

  it("usuário desativado não lê nem escreve vídeos nem limites", async () => {
    await runAs(db, asUser(inactiveId), async () => {
      expect((await db.query("select * from public.videos")).rows).toHaveLength(0);
      expect((await db.query("select * from public.video_settings")).rows).toHaveLength(0);
      expect((await pgError(db, "insert into public.videos (title, source_type, source, orientation) values ('x', 'youtube', 'abcdefghijk', 'landscape')")).code).toBe("42501");
      await db.query("update public.video_settings set home_limit_desktop = 12");
    });
    expect((await db.query("select home_limit_desktop from public.video_settings")).rows[0]).toEqual({
      home_limit_desktop: 3,
    });
  });

  it("formatos inválidos são barrados pelo banco", async () => {
    await runAs(db, asUser(editorId), async () => {
      const bad = (source_type: string, source: string, poster: string | null = null) =>
        pgError(
          db,
          "insert into public.videos (title, source_type, source, poster, orientation) values ('x', $1, $2, $3, 'portrait')",
          [source_type, source, poster],
        );
      expect((await bad("youtube", "https://youtu.be/abcdefghijk")).code).toBe("23514");
      expect((await bad("local", "videos/a.mp4")).code).toBe("23514");
      expect((await bad("local", "/videos/a b.mp4")).code).toBe("23514");
      expect((await bad("local", "/videos/a.mp4", "javascript:x")).code).toBe("23514");
      expect((await pgError(db, "update public.videos set placement = 'destaque'")).code).toBe("22P02");
    });
  });

  it("move_video troca posições só dentro da classificação; no topo não faz nada", async () => {
    await runAs(db, asUser(editorId), async () => {
      const foiDeus = await idOf("Foi Deus (AO VIVO)");
      await db.query("select public.move_video($1, 'up')", [foiDeus]);
      expect(await titles("secondary")).toEqual(["Foi Deus (AO VIVO)", "Conheça nosso show", "SÓ PRO MEU PRAZER (AO VIVO)"]);
      await db.query("select public.move_video($1, 'up')", [foiDeus]);
      expect((await titles("secondary"))[0]).toBe("Foi Deus (AO VIVO)");

      const lastSecondary = await idOf("SÓ PRO MEU PRAZER (AO VIVO)");
      const galleryBefore = await titles("gallery");
      await db.query("select public.move_video($1, 'down')", [lastSecondary]);
      expect(await titles("gallery")).toEqual(galleryBefore);
    });
  });

  it("desativar tira do site e preserva o registro (com a classificação); reativar devolve", async () => {
    await runAs(db, asUser(editorId), async () => {
      await db.query("update public.videos set active = false where title = 'Foi Deus (AO VIVO)'");
      expect((await publicTitles()).map((row) => row.title)).not.toContain("Foi Deus (AO VIVO)");
      expect(await titles("secondary")).toContain("Foi Deus (AO VIVO)");
      await db.query("update public.videos set active = true where title = 'Foi Deus (AO VIVO)'");
      expect((await publicTitles())[1].title).toBe("Foi Deus (AO VIVO)");
    });
  });
});

describe("vídeo principal (no máximo um)", () => {
  it("o primeiro principal pode ser marcado direto; um segundo é barrado com mensagem (AG006)", async () => {
    await runAs(db, asUser(editorId), async () => {
      await db.query("update public.videos set placement = 'main' where title = 'AMIGO'");
      expect(await titles("main")).toEqual(["AMIGO"]);
      const second = await pgError(db, "update public.videos set placement = 'main' where title = 'Foi Deus (AO VIVO)'");
      expect(second.code).toBe("AG006");
      expect((await pgError(db, "insert into public.videos (title, source_type, source, orientation, placement) values ('x', 'youtube', 'abcdefghijk', 'portrait', 'main')")).code).toBe("AG006");
      // Editar o próprio principal continua permitido.
      await db.query("update public.videos set title = 'AMIGO (ao vivo)' where title = 'AMIGO'");
    });
  });

  it("set_main_video troca numa operação: o anterior vira o PRIMEIRO secundário", async () => {
    await runAs(db, asUser(editorId), async () => {
      await db.query("select public.set_main_video($1)", [await idOf("AMIGO")]);
      await db.query("select public.set_main_video($1)", [await idOf("Ela é demais")]);
      expect(await titles("main")).toEqual(["Ela é demais"]);
      expect((await titles("secondary"))[0]).toBe("AMIGO");
      // Vertical ou horizontal: tanto faz.
      const { rows } = await db.query("select orientation from public.videos where placement = 'main'");
      expect(rows[0]).toEqual({ orientation: "portrait" });
      // Repetir no mesmo vídeo não muda nada.
      await db.query("select public.set_main_video($1)", [await idOf("Ela é demais")]);
      expect(await titles("main")).toEqual(["Ela é demais"]);
    });
  });

  it("vídeo inativo não pode ser promovido", async () => {
    await runAs(db, asUser(editorId), async () => {
      await db.query("update public.videos set active = false where title = 'AMIGO'");
      expect((await pgError(db, "select public.set_main_video($1)", [await idOf("AMIGO")])).code).toBe("22023");
    });
  });

  it("principal desativado some do site; a Home segue com os secundários (nada promovido sozinho)", async () => {
    await runAs(db, asUser(editorId), async () => {
      await db.query("select public.set_main_video($1)", [await idOf("AMIGO")]);
      await db.query("update public.videos set active = false where title = 'AMIGO'");
      const rows = await publicTitles();
      expect(rows.some((row) => row.placement === "main")).toBe(false);
      expect(rows.filter((row) => row.placement === "secondary")).toHaveLength(3);
      // E outro pode ser escolhido como principal.
      await db.query("select public.set_main_video($1)", [await idOf("Foi Deus (AO VIVO)")]);
      expect(await titles("main")).toEqual(["Foi Deus (AO VIVO)"]);
    });
  });

  it("o índice único segura dois principais mesmo sem o trigger (corrida entre atualizações)", async () => {
    await runAs(db, superuser, async () => {
      await db.query("select public.set_main_video($1)", [await idOf("AMIGO")]);
      await db.exec("alter table public.videos disable trigger videos_before_write");
      const race = await pgError(db, "update public.videos set placement = 'main' where title = 'Foi Deus (AO VIVO)'");
      expect(race.code).toBe("23505");
    });
  });

  it("sem nenhum vídeo principal nem secundário: permitido (a regra antiga do destaque obrigatório saiu)", async () => {
    await runAs(db, asUser(editorId), async () => {
      await db.query("update public.videos set placement = 'gallery'");
      await db.query("delete from public.videos where title = 'AMIGO'");
      expect(await titles("secondary")).toEqual([]);
      await db.query("delete from public.videos");
      await insert("Primeiro", "gallery");
    });
  });
});

describe("limites da Home", () => {
  it("staff altera desktop e celular de forma independente; autoria pela sessão", async () => {
    await runAs(db, asUser(editorId), async () => {
      await db.query("update public.video_settings set home_limit_desktop = 6, home_limit_mobile = 2");
      const { rows } = await db.query("select home_limit_desktop, home_limit_mobile, updated_by from public.video_settings");
      expect(rows[0]).toEqual({ home_limit_desktop: 6, home_limit_mobile: 2, updated_by: editorId });
      expect((await db.query("select * from public.get_public_video_settings()")).rows).toEqual([
        { home_limit_desktop: 6, home_limit_mobile: 2 },
      ]);
    });
  });

  it("só inteiros de 1 a 12; uma linha só (sem criar nem apagar)", async () => {
    await runAs(db, asUser(editorId), async () => {
      for (const value of [0, 13, -1]) {
        expect((await pgError(db, "update public.video_settings set home_limit_mobile = $1", [value])).code).toBe("23514");
      }
      expect((await pgError(db, "insert into public.video_settings (id) values (true)")).code).toBe("42501");
      expect((await pgError(db, "delete from public.video_settings")).code).toBe("42501");
    });
  });
});
