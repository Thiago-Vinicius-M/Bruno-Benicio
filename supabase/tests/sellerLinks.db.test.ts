// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actAs, anon, asUser, createTestDb, createUser, pgError, runAs, superuser } from "./support/testDb";

/**
 * Links comerciais (migrations 20261017120000_seller_links.sql e
 * 20261018120100_commercial_links_module.sql), direto no Postgres, como cada papel.
 * Tempo determinístico: dentro de uma transação now() é fixo, então "expira exatamente
 * agora" é testado com expires_at = now().
 */

let db: PGlite;
let adminId: string;
let sellerId: string;
let pricerId: string;
let otherSellerId: string;
let editorId: string;
let inactiveAdminId: string;
let inactiveSellerId: string;
let outsiderId: string;
/** Modelos do seed (lidos como superusuário: vendedor não enxerga show_models pelo RLS). */
let MODELS: { id: string; name: string; price: number }[];

const PHONE = "5562999998888";
const PHONE_2 = "5562988887777";
const PHONE_3 = "5562977776666";
const DEFAULTS = { "Voz e violão": 1500, "Voz, violão e bateria": 1800, "Voz, violão, sanfona e bateria": 2200, "Bruno e Benício e banda": 3000 };
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

type Item = { model_id: string; price?: number | null };
type Created = { id: string; code: string; expires_at: string };

beforeAll(async () => {
  db = await createTestDb();
  adminId = await createUser(db, "admin@example.com", "ADMIN");
  sellerId = await createUser(db, "vendedor@example.com", "SELLER");
  pricerId = await createUser(db, "negocia@example.com", "SELLER");
  await db.query("update public.profiles set can_customize_link_prices = true where id = $1", [pricerId]);
  otherSellerId = await createUser(db, "outro@example.com", "SELLER");
  editorId = await createUser(db, "editor@example.com", "EDITOR");
  inactiveAdminId = await createUser(db, "inativo@example.com", "ADMIN");
  inactiveSellerId = await createUser(db, "ex-vendedor@example.com", "SELLER");
  await db.query("update public.profiles set deactivated_at = now() where id in ($1, $2)", [inactiveAdminId, inactiveSellerId]);
  outsiderId = await createUser(db, "sem-perfil@example.com");
  MODELS = await activeModels();
});

afterAll(async () => {
  await db?.close();
});

/** Canal cadastrado como o papel atual da transação (ADMIN ou SQL Editor). */
const insertChannel = async (ownerId: string, whatsapp = PHONE, label = "Comercial", primary = false) =>
  (
    await db.query<{ id: string }>(
      "insert into public.whatsapp_channels (owner_id, whatsapp, label, is_primary) values ($1, $2, $3, $4) returning id",
      [ownerId, whatsapp, label, primary],
    )
  ).rows[0];

/** Modelos ativos com o preço padrão, na ordem do site. */
const activeModels = async () =>
  (
    await db.query<{ id: string; name: string; price: string }>(
      "select id, name, price from public.show_models where active order by position, created_at, id",
    )
  ).rows.map((row) => ({ id: row.id, name: row.name, price: Number(row.price) }));

/** Todos os modelos do seed; com `overrides`, troca o preço pelo nome; os demais vão sem preço (padrão). */
const itemsFor = async (overrides: Record<string, number> = {}): Promise<Item[]> =>
  MODELS.map((model) =>
    model.name in overrides ? { model_id: model.id, price: overrides[model.name] } : { model_id: model.id },
  );

const createLink = async (channelId: string | null, items: unknown, validity = "24h", expiresAt: string | null = null, label: string | null = null) =>
  (
    await db.query<Created>("select * from public.create_commercial_link($1, $2, $3, $4, $5::jsonb)", [
      channelId,
      label,
      validity,
      expiresAt,
      JSON.stringify(items),
    ])
  ).rows[0];

const createLinkError = (channelId: string | null, items: unknown, validity = "24h", expiresAt: string | null = null) =>
  pgError(db, "select * from public.create_commercial_link($1, null, $2, $3, $4::jsonb)", [
    channelId,
    validity,
    expiresAt,
    JSON.stringify(items),
  ]);

/** O que o site mostra para o código (versão comercial). */
const commercial = async (code: string | null) =>
  (await db.query<{ name: string; price: string }>("select * from public.get_commercial_show_models($1)", [code])).rows.map(
    (row) => ({ name: row.name, price: Number(row.price) }),
  );

const resolve = async (code: string) =>
  (
    await db.query<{ active: boolean; whatsapp: string | null; link_kind: string; status: string; expires_at: string | null }>(
      "select * from public.get_seller_link($1)",
      [code],
    )
  ).rows;

/** Link novo já vencido (só o SQL Editor informa created_at). */
const insertPastChannelLink = async (channelId: string, createdAgo: string, expiresAgo: string) => {
  const { rows } = await db.query<{ id: string; code: string }>(
    `insert into public.seller_links (channel_id, whatsapp, channel_label, created_by, created_at, expires_at)
     select c.id, c.whatsapp, c.label, c.owner_id, now() - $2::interval, now() - $3::interval
     from public.whatsapp_channels c where c.id = $1 returning id, code`,
    [channelId, createdAgo, expiresAgo],
  );
  for (const model of await activeModels()) {
    await db.query("insert into public.seller_link_prices (link_id, model_id, price, default_price) values ($1, $2, $3, $3)", [
      rows[0].id,
      model.id,
      model.price,
    ]);
  }
  return rows[0];
};

const dbNow = async () => (await db.query<{ now: Date }>("select now()")).rows[0].now.getTime();

const linkRow = async (id: string) =>
  (
    await db.query<{ channel_id: string; whatsapp: string; channel_label: string; created_by: string }>(
      "select channel_id, whatsapp, channel_label, created_by from public.seller_links where id = $1",
      [id],
    )
  ).rows[0];

describe("papéis: SELLER não herda o acesso de staff", () => {
  it("vendedor não lê nem altera agenda, vídeos, configurações, modelos, vendedores antigos nem perfis da equipe", async () => {
    await runAs(db, asUser(sellerId), async () => {
      for (const table of ["shows", "show_financial_entries", "videos", "video_settings", "agenda_settings", "show_models"]) {
        expect((await db.query(`select * from public.${table}`)).rows, table).toHaveLength(0);
      }
      expect((await db.query("select id from public.profiles")).rows).toEqual([{ id: sellerId }]);
      expect((await db.query("select * from public.get_team_names()")).rows).toHaveLength(0);
      expect((await pgError(db, "select * from public.get_whatsapp_channel_owners()")).code).toBe("42501");
      expect(
        (await pgError(db, "insert into public.shows (show_date, show_time, venue_name) values (current_date, '20:00', 'Casa')")).code,
      ).toBe("42501");
      expect((await db.query("update public.video_settings set home_limit_desktop = 5 returning 1")).rows).toHaveLength(0);
      expect((await db.query("update public.show_models set price = 1 returning id")).rows).toHaveLength(0);
      expect((await db.query("update public.agenda_settings set public_enabled = false returning 1")).rows).toHaveLength(0);
    });
  });

  it("ADMIN e EDITOR continuam staff; o SELLER não", async () => {
    const isStaff = async (userId: string) =>
      runAs(db, asUser(userId), async () => (await db.query<{ v: boolean }>("select private.is_staff() as v")).rows[0].v);
    expect(await isStaff(adminId)).toBe(true);
    expect(await isStaff(editorId)).toBe(true);
    expect(await isStaff(sellerId)).toBe(false);
  });

  it("permissões do módulo: ADMIN cria e personaliza; SELLER cria e só personaliza se autorizado; EDITOR nada", async () => {
    const perms = async (userId: string) =>
      runAs(db, asUser(userId), async () => (await db.query("select * from public.get_commercial_link_permissions()")).rows[0]);
    expect(await perms(adminId)).toEqual({ can_create: true, can_customize_prices: true });
    expect(await perms(sellerId)).toEqual({ can_create: true, can_customize_prices: false });
    expect(await perms(pricerId)).toEqual({ can_create: true, can_customize_prices: true });
    expect(await perms(editorId)).toEqual({ can_create: false, can_customize_prices: false });
    expect(await perms(inactiveSellerId)).toEqual({ can_create: false, can_customize_prices: false });
    expect(await perms(outsiderId)).toEqual({ can_create: false, can_customize_prices: false });
  });

  it("perfil continua sem escrita pela API (a permissão de preço não é autoconcedida)", async () => {
    await runAs(db, asUser(sellerId), async () => {
      expect((await pgError(db, "update public.profiles set can_customize_link_prices = true where id = $1", [sellerId])).code).toBe("42501");
    });
  });
});

describe("canais de WhatsApp", () => {
  it("ADMIN cadastra vários canais por usuário; o dono só lê os próprios", async () => {
    await runAs(db, asUser(adminId), async () => {
      const a = await insertChannel(sellerId, PHONE, "  Comercial   loja ", true);
      const b = await insertChannel(sellerId, PHONE_2, "Pessoal");
      await insertChannel(otherSellerId, PHONE_3, "Outro");
      const { rows } = await db.query("select label, is_primary, created_by from public.whatsapp_channels where id = $1", [a.id]);
      expect(rows[0]).toEqual({ label: "Comercial loja", is_primary: true, created_by: adminId });

      await actAs(db, asUser(sellerId));
      const own = await db.query<{ id: string }>("select id from public.whatsapp_channels order by created_at, id");
      expect(own.rows.map((row) => row.id).sort()).toEqual([a.id, b.id].sort());
      // Vendedor não cadastra nem altera canais (nem os próprios).
      expect((await pgError(db, "insert into public.whatsapp_channels (owner_id, whatsapp, label) values ($1, $2, 'X')", [sellerId, PHONE_3])).code).toBe(
        "42501",
      );
      expect((await db.query("update public.whatsapp_channels set label = 'Hack' returning id")).rows).toHaveLength(0);
      expect((await pgError(db, "delete from public.whatsapp_channels")).code).toBe("42501");
    });
  });

  it("número validado, sem duplicar para o mesmo usuário; número e dono não mudam; nada é apagado", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(sellerId);
      expect((await pgError(db, "insert into public.whatsapp_channels (owner_id, whatsapp, label) values ($1, $2, 'Dup')", [sellerId, PHONE])).code).toBe(
        "23505",
      );
      for (const bad of ["556299999888", "5562099998888", "+5562999998888", "123"]) {
        expect(
          (await pgError(db, "insert into public.whatsapp_channels (owner_id, whatsapp, label) values ($1, $2, 'X')", [sellerId, bad])).code,
          bad,
        ).toBe("23514");
      }
      expect((await pgError(db, "insert into public.whatsapp_channels (owner_id, whatsapp, label) values ($1, $2, '   ')", [sellerId, PHONE_2])).code).toBe(
        "23514",
      );
      // O mesmo número pode estar em outro usuário (ex.: número compartilhado da empresa).
      await insertChannel(otherSellerId, PHONE);
      expect((await pgError(db, "update public.whatsapp_channels set whatsapp = $2 where id = $1", [channel.id, PHONE_2])).code).toBe("AG008");
      expect((await pgError(db, "update public.whatsapp_channels set owner_id = $2 where id = $1", [channel.id, otherSellerId])).code).toBe(
        "AG008",
      );
      await actAs(db, superuser);
      expect((await pgError(db, "delete from public.whatsapp_channels where id = $1", [channel.id])).code).toBe("AG008");
    });
  });

  it("só usuários ativos ADMIN/SELLER recebem canal", async () => {
    await runAs(db, asUser(adminId), async () => {
      for (const owner of [editorId, inactiveSellerId]) {
        expect((await pgError(db, "insert into public.whatsapp_channels (owner_id, whatsapp, label) values ($1, $2, 'X')", [owner, PHONE])).code).toBe(
          "22023",
        );
      }
      await insertChannel(adminId);
    });
  });

  it("um principal por usuário; desativar tira o principal; ativo não redireciona", async () => {
    await runAs(db, asUser(adminId), async () => {
      const a = await insertChannel(sellerId, PHONE, "A", true);
      const b = await insertChannel(sellerId, PHONE_2, "B", true);
      const primaries = async () =>
        (await db.query<{ id: string }>("select id from public.whatsapp_channels where owner_id = $1 and is_primary", [sellerId])).rows.map((r) => r.id);
      expect(await primaries()).toEqual([b.id]);
      await db.query("update public.whatsapp_channels set is_primary = true where id = $1", [a.id]);
      expect(await primaries()).toEqual([a.id]);
      await db.query("update public.whatsapp_channels set active = false where id = $1", [a.id]);
      expect(await primaries()).toEqual([]);
      // Redirecionamento só para canal ativo, e é limpo ao reativar.
      const c = await insertChannel(otherSellerId, PHONE_3, "C");
      expect((await pgError(db, "update public.whatsapp_channels set redirect_channel_id = $2 where id = $1", [b.id, c.id])).code).toBe("23514");
      await db.query("update public.whatsapp_channels set active = false where id = $1", [c.id]);
      expect((await pgError(db, "update public.whatsapp_channels set redirect_channel_id = $2 where id = $1", [a.id, c.id])).code).toBe("22023");
      await db.query("update public.whatsapp_channels set redirect_channel_id = $2 where id = $1", [a.id, b.id]);
      await db.query("update public.whatsapp_channels set active = true where id = $1", [a.id]);
      expect((await db.query("select redirect_channel_id from public.whatsapp_channels where id = $1", [a.id])).rows[0]).toEqual({
        redirect_channel_id: null,
      });
    });
  });
});

describe("criação de link", () => {
  it("vendedor cria com um canal próprio: autoria, canal, número e identificação gravados; preços padrão", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(sellerId, PHONE, "Comercial");
      await actAs(db, asUser(sellerId));
      const link = await createLink(channel.id, await itemsFor(), "24h", null, "  Casamento João  ");
      expect(link.code).toMatch(/^[2-9a-km-np-z]{8}$/);
      expect(await linkRow(link.id)).toEqual({
        channel_id: channel.id,
        whatsapp: PHONE,
        channel_label: "Comercial",
        created_by: sellerId,
      });
      expect(await commercial(link.code)).toEqual(Object.entries(DEFAULTS).map(([name, price]) => ({ name, price })));
      const { rows } = await db.query<{ price: string; default_price: string }>(
        "select price, default_price from public.seller_link_prices where link_id = $1",
        [link.id],
      );
      expect(rows.every((row) => row.price === row.default_price)).toBe(true);
    });
  });

  it("usuário com vários canais escolhe qual recebe os contatos de cada link", async () => {
    await runAs(db, asUser(adminId), async () => {
      const a = await insertChannel(sellerId, PHONE, "A", true);
      const b = await insertChannel(sellerId, PHONE_2, "B");
      await actAs(db, asUser(sellerId));
      const viaA = await createLink(a.id, await itemsFor());
      const viaB = await createLink(b.id, await itemsFor());
      await actAs(db, anon);
      expect((await resolve(viaA.code))[0].whatsapp).toBe(PHONE);
      expect((await resolve(viaB.code))[0].whatsapp).toBe(PHONE_2);
    });
  });

  it("WhatsApp obrigatório; canal de outro usuário, inexistente ou desativado é recusado da mesma forma", async () => {
    await runAs(db, asUser(adminId), async () => {
      const own = await insertChannel(sellerId, PHONE, "Próprio");
      const others = await insertChannel(otherSellerId, PHONE_2, "Do outro");
      const adminChannel = await insertChannel(adminId, PHONE_3, "Do ADMIN");
      await db.query("update public.whatsapp_channels set active = false where id = $1", [own.id]);
      await actAs(db, asUser(sellerId));
      const items = await itemsFor();
      expect((await createLinkError(null, items)).code).toBe("22023");
      for (const id of [others.id, adminChannel.id, UNKNOWN_ID, own.id]) {
        const error = await createLinkError(id, items);
        expect(error.code, id).toBe("42501");
        expect(error.message).toContain("WhatsApp não autorizado");
      }
      // ADMIN também só usa os próprios canais.
      await actAs(db, asUser(adminId));
      expect((await createLinkError(others.id, items)).code).toBe("42501");
      await createLink(adminChannel.id, items);
    });
  });

  it("usuário sem canal cadastrado não gera link", async () => {
    await runAs(db, asUser(sellerId), async () => {
      expect((await db.query("select * from public.whatsapp_channels")).rows).toHaveLength(0);
      expect((await createLinkError(UNKNOWN_ID, [])).code).toBe("42501");
    });
  });

  it("vendedor sem permissão: preço igual ao padrão é aceito, diferente é recusado; nada é gravado", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(sellerId);
      await actAs(db, asUser(sellerId));
      const [first] = MODELS;
      await createLink(channel.id, [{ model_id: first.id, price: first.price }]);
      const error = await createLinkError(channel.id, await itemsFor({ "Voz e violão": 1400 }));
      expect(error.code).toBe("42501");
      expect((await db.query("select 1 from public.seller_links where created_by = $1", [sellerId])).rows).toHaveLength(1);
    });
  });

  it("vendedor autorizado personaliza preços sem alterar show_models.price", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(pricerId);
      await actAs(db, asUser(pricerId));
      const link = await createLink(channel.id, await itemsFor({ "Voz e violão": 1234.56, "Bruno e Benício e banda": 2800 }));
      expect(await commercial(link.code)).toEqual([
        { name: "Voz e violão", price: 1234.56 },
        { name: "Voz, violão e bateria", price: 1800 },
        { name: "Voz, violão, sanfona e bateria", price: 2200 },
        { name: "Bruno e Benício e banda", price: 2800 },
      ]);
      await actAs(db, superuser);
      expect((await activeModels()).map((model) => model.price)).toEqual(Object.values(DEFAULTS));
      const { rows } = await db.query<{ price: string; default_price: string }>(
        "select p.price, p.default_price from public.seller_link_prices p join public.show_models m on m.id = p.model_id where p.link_id = $1 and m.name = 'Voz e violão'",
        [link.id],
      );
      expect(rows[0]).toEqual({ price: "1234.56", default_price: "1500.00" });
    });
  });

  it("um ou mais modelos: só os escolhidos entram no link", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(adminId);
      const models = MODELS;
      const link = await createLink(channel.id, [{ model_id: models[1].id }, { model_id: models[3].id, price: 3100 }]);
      expect(await commercial(link.code)).toEqual([
        { name: "Voz, violão e bateria", price: 1800 },
        { name: "Bruno e Benício e banda", price: 3100 },
      ]);
    });
  });

  it("alterar o preço padrão ou o canal depois não muda a proposta já gerada", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(adminId, PHONE, "Comercial");
      const link = await createLink(channel.id, await itemsFor({ "Voz e violão": 1400 }));
      await db.query("update public.show_models set price = 9999");
      await db.query("update public.whatsapp_channels set label = 'Renomeado' where id = $1", [channel.id]);
      const prices = await commercial(link.code);
      expect(prices[0]).toEqual({ name: "Voz e violão", price: 1400 });
      expect(prices[1]).toEqual({ name: "Voz, violão e bateria", price: 1800 });
      expect(await linkRow(link.id)).toMatchObject({ whatsapp: PHONE, channel_label: "Comercial" });
    });
  });

  it("valores: maior que zero, até 2 casas e no limite de numeric(10,2); nada é arredondado", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(adminId);
      for (const bad of [0, -10, 10.005, 100000000, "1500", true]) {
        const items = await itemsFor();
        (items[0] as { price: unknown }).price = bad;
        expect((await createLinkError(channel.id, items)).code, String(bad)).toBe("22023");
      }
      const max = await createLink(channel.id, await itemsFor({ "Voz e violão": 99999999.99 }));
      expect((await commercial(max.code))[0].price).toBe(99999999.99);
    });
  });

  it("recusa modelo repetido, desativado, inexistente, id inválido e lista vazia", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(adminId);
      const items = await itemsFor();
      await db.query("update public.show_models set active = false where name = 'Bruno e Benício e banda'");
      const active = items.slice(0, 3);
      const cases: unknown[] = [
        [...active, active[0]],
        items,
        [...active, { model_id: UNKNOWN_ID }],
        [{ model_id: "não-é-uuid" }],
        ["texto"],
        [],
        {},
        null,
      ];
      for (const bad of cases) {
        expect((await createLinkError(channel.id, bad)).code, JSON.stringify(bad)).toBe("22023");
      }
    });
  });

  it("falha em qualquer item desfaz tudo: nenhum link parcial", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(adminId);
      const items = await itemsFor();
      items[2].price = -1;
      expect((await createLinkError(channel.id, items)).code).toBe("22023");
      expect((await db.query("select 1 from public.seller_links")).rows).toHaveLength(0);
      expect((await db.query("select 1 from public.seller_link_prices")).rows).toHaveLength(0);
    });
  });

  it("EDITOR, usuários desativados e sem perfil não criam, consultam nem desativam", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(adminId);
      const link = await createLink(channel.id, await itemsFor());
      for (const userId of [editorId, inactiveAdminId, inactiveSellerId, outsiderId]) {
        await actAs(db, asUser(userId));
        expect((await createLinkError(channel.id, [{ model_id: UNKNOWN_ID }])).code, userId).toBe("42501");
        expect((await pgError(db, "select * from public.get_seller_links()")).code).toBe("42501");
        expect((await pgError(db, "select * from public.get_link_show_models()")).code).toBe("42501");
        expect((await pgError(db, "select public.deactivate_seller_link($1)", [link.id])).code).toBe("42501");
        expect((await db.query("select * from public.seller_links")).rows).toHaveLength(0);
        expect((await db.query("select * from public.seller_link_prices")).rows).toHaveLength(0);
        expect((await db.query("select * from public.whatsapp_channels")).rows).toHaveLength(0);
      }
    });
  });

  it("vendedor lê os modelos ativos com o preço padrão só pela função do módulo", async () => {
    await runAs(db, asUser(sellerId), async () => {
      const { rows } = await db.query<{ name: string; price: string }>("select name, price from public.get_link_show_models()");
      expect(rows.map((row) => ({ name: row.name, price: Number(row.price) }))).toEqual(
        Object.entries(DEFAULTS).map(([name, price]) => ({ name, price })),
      );
    });
  });
});

describe("validade", () => {
  it.each([
    ["24h", 24],
    ["3d", 72],
    ["7d", 168],
  ])("prazo predefinido %s: calculado pelo banco a partir de now()", async (validity, hours) => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(adminId);
      const link = await createLink(channel.id, await itemsFor(), validity);
      const now = await dbNow();
      expect(new Date(link.expires_at).getTime() - now).toBe(hours * 3_600_000);
    });
  });

  it("personalizado: aceita qualquer instante futuro até exatamente 7 dias", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(adminId);
      const now = await dbNow();
      for (const offset of [1, 3_600_000, 5 * 86_400_000 + 1234, 7 * 86_400_000]) {
        const link = await createLink(channel.id, await itemsFor(), "custom", new Date(now + offset).toISOString());
        expect(new Date(link.expires_at).getTime()).toBe(now + offset);
      }
    });
  });

  it("personalizado: rejeita passado, o instante atual, mais de 7 dias e ausência de data; predefinido ignora p_expires_at", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(adminId);
      const now = await dbNow();
      for (const offset of [-60_000, 0, 7 * 86_400_000 + 1]) {
        expect((await createLinkError(channel.id, await itemsFor(), "custom", new Date(now + offset).toISOString())).code).toBe("22023");
      }
      expect((await createLinkError(channel.id, await itemsFor(), "custom", null)).code).toBe("22023");
      expect((await createLinkError(channel.id, await itemsFor(), "30d", null)).code).toBe("22023");
      const link = await createLink(channel.id, await itemsFor(), "24h", new Date(now + 30 * 86_400_000).toISOString());
      expect(new Date(link.expires_at).getTime() - now).toBe(24 * 3_600_000);
    });
  });

  it("nem o SQL Editor grava validade acima de 7 dias ou expiração antes da criação", async () => {
    await runAs(db, superuser, async () => {
      const channel = await insertChannel(adminId);
      const bad = (created: string, expires: string) =>
        pgError(
          db,
          `insert into public.seller_links (channel_id, whatsapp, channel_label, created_at, expires_at)
           values ($1, $2, 'C', now() + $3::interval, now() + $4::interval)`,
          [channel.id, PHONE, created, expires],
        );
      expect((await bad("0", "168 hours 1 second")).code).toBe("23514");
      expect((await bad("0", "0")).code).toBe("23514");
      expect((await bad("0", "-1 hour")).code).toBe("23514");
    });
  });

  it("expira exatamente em expires_at (now() >= expires_at); um microssegundo antes ainda vale", async () => {
    await runAs(db, superuser, async () => {
      const channel = await insertChannel(sellerId);
      const atNow = await insertPastChannelLink(channel.id, "1 day", "0");
      const almost = await insertPastChannelLink(channel.id, "1 day", "-1 microsecond");
      await actAs(db, anon);
      expect(await resolve(atNow.code)).toEqual([{ active: false, whatsapp: null, link_kind: "link", status: "expired", expires_at: null }]);
      expect(await commercial(atNow.code)).toEqual([]);
      expect((await resolve(almost.code))[0]).toMatchObject({ active: true, whatsapp: PHONE, status: "active" });
      expect(await commercial(almost.code)).toHaveLength(4);
    });
  });
});

describe("site público (anon)", () => {
  it("link válido: preços do link, o WhatsApp gravado e a expiração; nada interno", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(adminId);
      const link = await createLink(channel.id, await itemsFor({ "Voz e violão": 1111 }));
      await actAs(db, anon);
      const [row] = await resolve(` ${link.code.toUpperCase()} `);
      expect(row).toMatchObject({ active: true, whatsapp: PHONE, link_kind: "link", status: "active" });
      expect(Object.keys(row).sort()).toEqual(["active", "expires_at", "link_kind", "status", "whatsapp"]);
      expect((await commercial(link.code))[0]).toEqual({ name: "Voz e violão", price: 1111 });
      for (const sql of [
        "select * from public.seller_links",
        "select * from public.seller_link_prices",
        "select * from public.whatsapp_channels",
        "select * from public.get_seller_links()",
        "select * from public.get_link_show_models()",
        "select * from public.get_whatsapp_channel_owners()",
        "select * from public.get_commercial_link_permissions()",
      ]) {
        expect((await pgError(db, sql)).code, sql).toBe("42501");
      }
      expect((await pgError(db, "select public.deactivate_seller_link($1)", [link.id])).code).toBe("42501");
      expect((await pgError(db, "select * from public.create_commercial_link($1, null, '24h', null, '[]'::jsonb)", [channel.id])).code).toBe(
        "42501",
      );
    });
  });

  it("desativado antes do vencimento: sem preços (status revoked)", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(adminId);
      const link = await createLink(channel.id, await itemsFor(), "7d");
      await db.query("select public.deactivate_seller_link($1)", [link.id]);
      await actAs(db, anon);
      expect((await resolve(link.code))[0]).toMatchObject({ active: false, whatsapp: null, status: "revoked" });
      expect(await commercial(link.code)).toEqual([]);
    });
  });

  it("canal desativado: link sem WhatsApp nem preços; com redirecionamento, segue para o novo número", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(sellerId, PHONE, "Antigo");
      const target = await insertChannel(otherSellerId, PHONE_2, "Novo");
      await actAs(db, asUser(sellerId));
      const link = await createLink(channel.id, await itemsFor());
      await actAs(db, asUser(adminId));
      await db.query("update public.whatsapp_channels set active = false where id = $1", [channel.id]);
      expect((await resolve(link.code))[0]).toMatchObject({ active: false, whatsapp: null, status: "inactive" });
      expect(await commercial(link.code)).toEqual([]);

      await db.query("update public.whatsapp_channels set redirect_channel_id = $2 where id = $1", [channel.id, target.id]);
      expect((await resolve(link.code))[0]).toMatchObject({ active: true, whatsapp: PHONE_2, status: "active" });
      expect(await commercial(link.code)).toHaveLength(4);
      // O destino gravado na proposta não muda.
      expect(await linkRow(link.id)).toMatchObject({ whatsapp: PHONE, channel_label: "Antigo" });
      const [history] = (await db.query<{ status: string; whatsapp: string; destination: string }>(
        "select status, whatsapp, destination from public.get_seller_links() where id = $1",
        [link.id],
      )).rows;
      expect(history).toEqual({ status: "active", whatsapp: PHONE, destination: PHONE_2 });

      // Reativado, volta ao número original.
      await db.query("update public.whatsapp_channels set active = true where id = $1", [channel.id]);
      expect((await resolve(link.code))[0].whatsapp).toBe(PHONE);
    });
  });

  it("dono do canal desativado: o link para de mandar contatos para ele", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(sellerId);
      await actAs(db, asUser(sellerId));
      const link = await createLink(channel.id, await itemsFor());
      await actAs(db, superuser);
      await db.query("update public.profiles set deactivated_at = now() where id = $1", [sellerId]);
      await actAs(db, anon);
      expect((await resolve(link.code))[0]).toMatchObject({ active: false, status: "inactive" });
    });
  });

  it("modelo desativado depois da criação sai; modelo criado depois não entra", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(adminId);
      const link = await createLink(channel.id, await itemsFor({ "Voz, violão e bateria": 1700 }));
      await db.query("update public.show_models set active = false where name = 'Voz e violão'");
      await db.query("insert into public.show_models (name, duration, price) values ('Acústico', '1h', 900)");
      expect((await commercial(link.code)).map((model) => model.name)).toEqual([
        "Voz, violão e bateria",
        "Voz, violão, sanfona e bateria",
        "Bruno e Benício e banda",
      ]);
    });
  });
});

describe("histórico, isolamento e imutabilidade", () => {
  it("ADMIN vê todos; vendedor só os próprios (outro vendedor não vê nem desativa)", async () => {
    await runAs(db, asUser(adminId), async () => {
      const mine = await insertChannel(sellerId, PHONE);
      const theirs = await insertChannel(otherSellerId, PHONE_2);
      await actAs(db, asUser(sellerId));
      const a = await createLink(mine.id, await itemsFor(), "3d", null, "Aniversário");
      await actAs(db, asUser(otherSellerId));
      const b = await createLink(theirs.id, await itemsFor());

      const ids = async () => (await db.query<{ id: string }>("select id from public.get_seller_links()")).rows.map((row) => row.id);
      expect(await ids()).toEqual([b.id]);
      expect((await db.query("select id from public.seller_links")).rows).toEqual([{ id: b.id }]);
      expect((await pgError(db, "select public.deactivate_seller_link($1)", [a.id])).code).toBe("22023");

      await actAs(db, asUser(sellerId));
      expect(await ids()).toEqual([a.id]);
      const [row] = (
        await db.query<{ created_by_name: string; channel_label: string; label: string; prices: { default_price: number }[] }>(
          "select created_by_name, channel_label, label, prices from public.get_seller_links()",
        )
      ).rows;
      expect(row).toMatchObject({ created_by_name: "vendedor", channel_label: "Comercial", label: "Aniversário" });
      expect(row.prices.map((price) => price.default_price)).toEqual(Object.values(DEFAULTS));
      await db.query("select public.deactivate_seller_link($1)", [a.id]);
      await db.query("select public.deactivate_seller_link($1)", [a.id]);

      await actAs(db, asUser(adminId));
      expect((await ids()).sort()).toEqual([a.id, b.id].sort());
      const statuses = Object.fromEntries(
        (await db.query<{ id: string; status: string }>("select id, status from public.get_seller_links()")).rows.map((r) => [r.id, r.status]),
      );
      expect(statuses).toEqual({ [a.id]: "revoked", [b.id]: "active" });
      // ADMIN desativa link de qualquer usuário.
      await db.query("select public.deactivate_seller_link($1)", [b.id]);
    });
  });

  it("nada da proposta muda depois de criada: preços, canal, número, validade; nada é apagado", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(adminId);
      const other = await insertChannel(adminId, PHONE_2, "Outro");
      const link = await createLink(channel.id, await itemsFor());
      expect((await pgError(db, "update public.seller_link_prices set price = 1")).code).toBe("42501");
      expect((await pgError(db, "update public.seller_links set whatsapp = $1", [PHONE_2])).code).toBe("42501");
      expect((await pgError(db, "delete from public.seller_links")).code).toBe("42501");
      await actAs(db, superuser);
      for (const [sql, params] of [
        ["update public.seller_link_prices set price = 1 where link_id = $1", [link.id]],
        ["delete from public.seller_link_prices where link_id = $1", [link.id]],
        ["update public.seller_links set whatsapp = '5562911112222' where id = $1", [link.id]],
        ["update public.seller_links set channel_label = 'X' where id = $1", [link.id]],
        ["update public.seller_links set channel_id = $2 where id = $1", [link.id, other.id]],
        ["update public.seller_links set expires_at = expires_at + interval '1 hour' where id = $1", [link.id]],
        ["delete from public.seller_links where id = $1", [link.id]],
      ] as const) {
        expect((await pgError(db, sql, [...params])).code, sql).toBe("AG007");
      }
    });
  });

  it("muitos links em sequência: códigos distintos e no formato", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(adminId);
      const items = await itemsFor();
      const codes = new Set<string>();
      for (let i = 0; i < 40; i++) codes.add((await createLink(channel.id, items)).code);
      expect(codes.size).toBe(40);
      for (const code of codes) expect(code).toMatch(/^[2-9a-km-np-z]{8}$/);
    });
  });
});

describe("códigos curtos (20261018120200)", () => {
  it("link já distribuído com código antigo de 16 caracteres continua funcionando", async () => {
    await runAs(db, asUser(adminId), async () => {
      const channel = await insertChannel(adminId);
      await actAs(db, superuser);
      const { rows } = await db.query<{ id: string }>(
        `insert into public.seller_links (code, channel_id, whatsapp, channel_label, created_by, expires_at)
         values ('0123456789abcdef', $1, $2, 'Comercial', $3, now() + interval '1 day') returning id`,
        [channel.id, PHONE, adminId],
      );
      await db.query("insert into public.seller_link_prices (link_id, model_id, price) values ($1, $2, 1500)", [rows[0].id, MODELS[0].id]);
      await actAs(db, anon);
      expect((await resolve("0123456789abcdef"))[0]).toMatchObject({ active: true, whatsapp: PHONE, status: "active" });
    });
  });
});

describe("sem vendedores antigos (20261018120300)", () => {
  it("tabela sellers e coluna seller_id não existem; link exige canal, número e identificação", async () => {
    await runAs(db, superuser, async () => {
      expect((await db.query("select to_regclass('public.sellers') as t")).rows[0]).toEqual({ t: null });
      expect(
        (await db.query("select 1 from information_schema.columns where table_name = 'seller_links' and column_name = 'seller_id'")).rows,
      ).toHaveLength(0);
      const channel = await insertChannel(adminId);
      for (const [sql, params] of [
        ["insert into public.seller_links (whatsapp, channel_label, expires_at) values ($1, 'C', now() + interval '1 hour')", [PHONE]],
        ["insert into public.seller_links (channel_id, channel_label, expires_at) values ($1, 'C', now() + interval '1 hour')", [channel.id]],
        ["insert into public.seller_links (channel_id, whatsapp, expires_at) values ($1, $2, now() + interval '1 hour')", [channel.id, PHONE]],
        ["insert into public.seller_links (channel_id, whatsapp, channel_label, expires_at) values ($1, '123', 'C', now() + interval '1 hour')", [channel.id]],
      ] as const) {
        expect(["23502", "23514"]).toContain((await pgError(db, sql, [...params])).code);
      }
      for (const fn of ["private.new_seller_code()", "private.link_code_is_free()", "private.sellers_before_write()"]) {
        expect((await db.query(`select to_regprocedure('${fn}') as f`)).rows[0]).toEqual({ f: null });
      }
    });
  });

  it("código inexistente ou de formato antigo de 12 caracteres: nada", async () => {
    await runAs(db, anon, async () => {
      for (const code of ["a1b2c3d4e5f6", "naoexiste00000000", "", null]) {
        expect(await commercial(code)).toEqual([]);
        if (code) expect(await resolve(code)).toEqual([]);
      }
    });
  });
});
