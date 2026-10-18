import { afterEach, describe, expect, it, vi } from "vitest";
import { zonedTimeToInstant } from "@/lib/agenda/dates";
import { createFakeSupabase } from "@/lib/agenda/testing/fakeSupabase";
import {
  createChannelFromInput,
  createCommercialLinkFromInput,
  deactivateChannelById,
  deactivateCommercialLinkById,
} from "@/lib/painel/commercialLinks";
import { parseChannelInput } from "./channelInput";
import { checkCustomExpiry, LINK_MAX_MS, LINK_PRESET_MS, parseCommercialLinkInput } from "./linkInput";
import { createCommercialLink, getLinkPermissions, listCommercialLinks } from "./linksRepository";

const CHANNEL_ID = "00000000-0000-4000-8000-0000000000aa";
const OWNER_ID = "00000000-0000-4000-8000-0000000000cc";
const LINK_ID = "00000000-0000-4000-8000-0000000000bb";
const M1 = "11111111-1111-4111-8111-111111111111";
const M2 = "22222222-2222-4222-8222-222222222222";
const ok = (data: unknown) => ({ data, error: null });

afterEach(() => vi.restoreAllMocks());

describe("horário de Brasília → instante absoluto", () => {
  it("America/Sao_Paulo (UTC−3, sem horário de verão desde 2019)", () => {
    expect(zonedTimeToInstant("2026-10-20", "18:00")?.toISOString()).toBe("2026-10-20T21:00:00.000Z");
    // Virada do dia em UTC.
    expect(zonedTimeToInstant("2026-10-20", "22:30")?.toISOString()).toBe("2026-10-21T01:30:00.000Z");
    expect(zonedTimeToInstant("2026-12-31", "23:59")?.toISOString()).toBe("2027-01-01T02:59:00.000Z");
    expect(zonedTimeToInstant("2026-10-20", "00:00")?.toISOString()).toBe("2026-10-20T03:00:00.000Z");
  });

  it("usa a base de fusos: horário de verão antigo (UTC−2) e horário inexistente", () => {
    expect(zonedTimeToInstant("2018-01-15", "12:00")?.toISOString()).toBe("2018-01-15T14:00:00.000Z");
    // 04/11/2018: os relógios pularam de 00:00 para 01:00.
    expect(zonedTimeToInstant("2018-11-04", "00:30")).toBeNull();
  });

  it("não depende do fuso do servidor e recusa entradas inválidas", () => {
    expect(zonedTimeToInstant("2026-10-20", "18:00", "UTC")?.toISOString()).toBe("2026-10-20T18:00:00.000Z");
    for (const [date, time] of [
      ["2026-02-30", "10:00"],
      ["20/10/2026", "10:00"],
      ["2026-10-20", "24:00"],
      ["2026-10-20", "9:00"],
      ["", ""],
    ]) {
      expect(zonedTimeToInstant(date, time), `${date} ${time}`).toBeNull();
    }
  });
});

describe("validade", () => {
  const NOW = new Date("2026-10-17T15:00:00.000Z"); // 12:00 em Brasília

  it("prazos predefinidos: 24 horas, 3 dias e 7 dias", () => {
    expect(LINK_PRESET_MS).toEqual({ "24h": 86_400_000, "3d": 259_200_000, "7d": 604_800_000 });
    expect(LINK_MAX_MS).toBe(604_800_000);
  });

  it("personalizado válido: futuro e até exatamente 7 dias", () => {
    expect(checkCustomExpiry("2026-10-17", "12:01", NOW)).toEqual({ ok: true, expiresAt: new Date("2026-10-17T15:01:00.000Z") });
    expect(checkCustomExpiry("2026-10-20", "18:00", NOW)).toEqual({ ok: true, expiresAt: new Date("2026-10-20T21:00:00.000Z") });
    expect(checkCustomExpiry("2026-10-24", "12:00", NOW)).toMatchObject({ ok: true });
  });

  it("recusa passado, o instante atual e mais de 7 dias", () => {
    expect(checkCustomExpiry("2026-10-17", "11:59", NOW)).toMatchObject({ ok: false, message: expect.stringMatching(/futuros/) });
    expect(checkCustomExpiry("2026-10-17", "12:00", NOW)).toMatchObject({ ok: false, message: expect.stringMatching(/futuros/) });
    expect(checkCustomExpiry("2026-10-24", "12:01", NOW)).toMatchObject({ ok: false, message: expect.stringMatching(/7 dias/) });
    expect(checkCustomExpiry("", "12:00", NOW)).toMatchObject({ ok: false });
    expect(checkCustomExpiry("2026-02-30", "12:00", NOW)).toMatchObject({ ok: false });
  });
});

describe("parseCommercialLinkInput (entrada do navegador)", () => {
  const base = {
    channelId: CHANNEL_ID,
    label: "  Casamento   João ",
    validity: "24h",
    items: [
      { modelId: M1, price: "1.500,00" },
      { modelId: M2, price: 1800.5 },
    ],
  };

  it("normaliza e descarta o que o navegador não decide (código, número, status, autoria, expiração do predefinido)", () => {
    const parsed = parseCommercialLinkInput({
      ...base,
      code: "escolhido0000000",
      active: true,
      created_by: "x",
      whatsapp: "5511999999999",
      expiresAt: "2030-01-01T00:00:00Z",
      date: "2026-10-20",
      time: "18:00",
    });
    expect(parsed).toEqual({
      channelId: CHANNEL_ID,
      label: "Casamento João",
      validity: "24h",
      expiresAt: null,
      tier: "private",
      items: [
        { modelId: M1, price: 1500 },
        { modelId: M2, price: 1800.5 },
      ],
    });
  });

  it("tipo de evento: corporativo passa adiante; inválido é recusado", () => {
    expect(parseCommercialLinkInput({ ...base, tier: "corporate" }).tier).toBe("corporate");
    expect(() => parseCommercialLinkInput({ ...base, tier: "vip" })).toThrow(/particular ou corporativo/);
  });

  it("modelo sem valor: o banco aplica o preço padrão", () => {
    expect(parseCommercialLinkInput({ ...base, items: [{ modelId: M1 }, { modelId: M2, price: null }] }).items).toEqual([
      { modelId: M1, price: null },
      { modelId: M2, price: null },
    ]);
  });

  it("personalizado: converte data/horário de Brasília para o instante", () => {
    expect(parseCommercialLinkInput({ ...base, validity: "custom", date: "2026-10-20", time: "18:00" }).expiresAt).toBe(
      "2026-10-20T21:00:00.000Z",
    );
  });

  it.each([
    [{ channelId: undefined }, /Escolha o WhatsApp/],
    [{ channelId: "x" }, /Escolha o WhatsApp/],
    [{ label: "x".repeat(81) }, /muito longa/],
    [{ validity: "30d" }, /validade/],
    [{ validity: "custom", date: "2026-10-20" }, /data e um horário/],
    [{ items: [] }, /ao menos um modelo/],
    [{ items: undefined }, /ao menos um modelo/],
    [{ items: [{ modelId: M1, price: "0" }] }, /valor válido/],
    [{ items: [{ modelId: M1, price: -5 }] }, /valor válido/],
    [{ items: [{ modelId: M1, price: "10,005" }] }, /valor válido/],
    [{ items: [{ modelId: M1, price: true }] }, /valor válido/],
    [{ items: [{ modelId: M1, price: 10 }, { modelId: M1, price: 20 }] }, /repetido/],
    [{ items: [{ modelId: "x", price: 10 }] }, /inválido/],
  ])("recusa %j", (patch, message) => {
    expect(() => parseCommercialLinkInput({ ...base, ...patch })).toThrow(message);
  });
});

describe("repositório de links comerciais", () => {
  it("criação chama a função transacional com o canal e os modelos (sem preço = padrão; sem expiração no predefinido)", async () => {
    const { client, calls } = createFakeSupabase([ok([{ id: LINK_ID, code: "0123456789abcdef", expires_at: "x" }])]);
    const created = await createCommercialLink(client, {
      channelId: CHANNEL_ID,
      label: null,
      validity: "7d",
      expiresAt: "2030-01-01T00:00:00.000Z",
      tier: "corporate",
      items: [
        { modelId: M1, price: 1400 },
        { modelId: M2, price: null },
      ],
    });
    expect(created.code).toBe("0123456789abcdef");
    expect(calls).toEqual([
      [
        "rpc",
        "create_commercial_link",
        {
          p_channel_id: CHANNEL_ID,
          p_label: null,
          p_validity: "7d",
          p_expires_at: null,
          p_items: [
            { model_id: M1, tier: "corporate", price: 1400 },
            { model_id: M2, tier: "corporate" },
          ],
        },
      ],
    ]);
  });

  it("permissões vêm do banco; resposta vazia nega tudo", async () => {
    expect(await getLinkPermissions(createFakeSupabase([ok([{ can_create: true, can_customize_prices: false }])]).client)).toEqual({
      canCreate: true,
      canCustomizePrices: false,
    });
    expect(await getLinkPermissions(createFakeSupabase([ok([])]).client)).toEqual({ canCreate: false, canCustomizePrices: false });
  });

  it("histórico: canal, autor e preços numéricos; status desconhecido nunca vira ativo", async () => {
    const row = {
      id: LINK_ID,
      seller_id: null,
      seller_name: null,
      channel_id: CHANNEL_ID,
      channel_label: "Comercial",
      whatsapp: "5562999998888",
      destination: "5562999998888",
      code: "0123456789abcdef",
      label: null,
      created_by: OWNER_ID,
      created_by_name: "Ana",
      created_at: "2026-10-17T12:00:00Z",
      expires_at: "2026-10-18T12:00:00Z",
      deactivated_at: null,
      status: "active",
      prices: [{ model_id: M1, name: "Voz e violão", price: "1400.00", default_price: "1500.00" }],
    };
    const links = await listCommercialLinks(
      createFakeSupabase([ok([row, { ...row, id: "y", status: "???" }, { ...row, id: "z", status: "inactive", destination: null }])]).client,
    );
    expect(links[0]).toMatchObject({
      status: "active",
      channel_label: "Comercial",
      created_by_name: "Ana",
      prices: [{ model_id: M1, name: "Voz e violão", price: 1400, default_price: 1500 }],
    });
    expect(links[1].status).toBe("revoked");
    expect(links[2]).toMatchObject({ status: "inactive", destination: null });
  });
});

describe("regras do painel (Server Actions)", () => {
  const input = { channelId: CHANNEL_ID, label: "", validity: "3d", items: [{ modelId: M1 }] };

  it("criar devolve o código gerado pelo banco", async () => {
    const { client } = createFakeSupabase([ok([{ id: LINK_ID, code: "0123456789abcdef", expires_at: "x" }])]);
    expect(await createCommercialLinkFromInput(client, input)).toEqual({
      status: "success",
      message: expect.stringMatching(/Link criado/),
      code: "0123456789abcdef",
    });
  });

  it("dados inválidos e WhatsApp ausente não chegam ao banco", async () => {
    const { client, calls } = createFakeSupabase();
    expect(await createCommercialLinkFromInput(client, { ...input, items: [] })).toMatchObject({ status: "error" });
    expect(await createCommercialLinkFromInput(client, { ...input, channelId: undefined })).toEqual({
      status: "error",
      message: "Escolha o WhatsApp que vai receber os contatos deste link.",
    });
    expect(calls).toHaveLength(0);
  });

  it("erro de validação do banco (ex.: mais de 7 dias, modelos mudaram) chega como mensagem", async () => {
    const dbError = { data: null, error: { code: "22023", message: "A validade máxima de um link é de 7 dias." } };
    expect(await createCommercialLinkFromInput(createFakeSupabase([dbError]).client, input)).toEqual({
      status: "error",
      message: "A validade máxima de um link é de 7 dias.",
    });
  });

  it("WhatsApp de outro usuário ou valor sem permissão: recusado pelo banco", async () => {
    const denied = { data: null, error: { code: "42501", message: "WhatsApp não autorizado para a sua conta." } };
    expect(await createCommercialLinkFromInput(createFakeSupabase([denied]).client, input)).toMatchObject({
      status: "error",
      message: expect.stringMatching(/permissão/),
    });
  });

  it("desativar: id inválido não chega ao banco; válido chama a função", async () => {
    const invalid = createFakeSupabase();
    expect(await deactivateCommercialLinkById(invalid.client, "x")).toEqual({ status: "error", message: "Link inválido." });
    expect(invalid.calls).toHaveLength(0);
    const { client, calls } = createFakeSupabase([ok(null)]);
    expect(await deactivateCommercialLinkById(client, LINK_ID)).toMatchObject({ status: "success" });
    expect(calls).toEqual([["rpc", "deactivate_seller_link", { p_id: LINK_ID }]]);
  });
});

describe("canais de WhatsApp (regras do painel)", () => {
  it("cadastro normaliza o número e só envia dono, número, identificação e principal", async () => {
    expect(
      parseChannelInput({ ownerId: OWNER_ID, whatsapp: "+55 (62) 99999-8888", label: "  Comercial  loja ", isPrimary: true, active: false }),
    ).toEqual({ owner_id: OWNER_ID, whatsapp: "5562999998888", label: "Comercial loja", is_primary: true });

    const { client, calls } = createFakeSupabase([ok({ id: CHANNEL_ID })]);
    expect(await createChannelFromInput(client, { ownerId: OWNER_ID, whatsapp: "+55 62 99999-8888", label: "Comercial" })).toMatchObject({
      status: "success",
    });
    expect(calls.find(([method]) => method === "insert")?.[1]).toEqual({
      owner_id: OWNER_ID,
      whatsapp: "5562999998888",
      label: "Comercial",
      is_primary: false,
    });
  });

  it("número, dono ou identificação inválidos não chegam ao banco; número repetido vira mensagem clara", async () => {
    for (const bad of [
      { ownerId: OWNER_ID, whatsapp: "62 99999-8888", label: "X" },
      { ownerId: "x", whatsapp: "+55 62 99999-8888", label: "X" },
      { ownerId: OWNER_ID, whatsapp: "+55 62 99999-8888", label: "   " },
    ]) {
      const { client, calls } = createFakeSupabase();
      expect(await createChannelFromInput(client, bad)).toMatchObject({ status: "error" });
      expect(calls).toHaveLength(0);
    }
    const duplicate = createFakeSupabase([{ data: null, error: { code: "23505", message: "duplicate key" } }]);
    expect(await createChannelFromInput(duplicate.client, { ownerId: OWNER_ID, whatsapp: "+55 62 99999-8888", label: "X" })).toEqual({
      status: "error",
      message: "Este número já está cadastrado para este usuário.",
    });
  });

  it("desativar: com ou sem redirecionamento; ids inválidos não chegam ao banco", async () => {
    const { client, calls } = createFakeSupabase([ok({ id: CHANNEL_ID }), ok({ id: CHANNEL_ID })]);
    expect(await deactivateChannelById(client, CHANNEL_ID, OWNER_ID)).toMatchObject({
      status: "success",
      message: expect.stringMatching(/número escolhido/),
    });
    expect(await deactivateChannelById(client, CHANNEL_ID, null)).toMatchObject({
      status: "success",
      message: expect.stringMatching(/deixam de abrir/),
    });
    expect(calls.filter(([method]) => method === "update").map(([, values]) => values)).toEqual([
      { active: false, redirect_channel_id: OWNER_ID },
      { active: false, redirect_channel_id: null },
    ]);
    const invalid = createFakeSupabase();
    expect(await deactivateChannelById(invalid.client, CHANNEL_ID, "x")).toMatchObject({ status: "error" });
    expect(await deactivateChannelById(invalid.client, "x", null)).toMatchObject({ status: "error" });
    expect(invalid.calls).toHaveLength(0);
  });
});
