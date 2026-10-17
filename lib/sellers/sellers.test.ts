import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/agenda/testing/fakeSupabase";
import { loadCommercialAccess } from "./commercialAccess";
import { resolveSellerLink } from "./resolveSellerLink";
import { isSellerCode, normalizeSellerCode, readSellerCookie, sellerLinkUrl } from "./sellerLink";
import { getSellerLink } from "./sellersRepository";
import { prepareWhatsAppReturn } from "./whatsappReturn";

const CODE = "a1b2c3d4e5f6";
const OTHER_CODE = "0f9e8d7c6b5a";
const PHONE = "5562999998888";
const MODEL_ID = "11111111-1111-4111-8111-111111111111";
const MODEL = { id: MODEL_ID, name: "Voz e violão", duration: "2h30 de show", description: null, price: 1500 };
const ok = (data: unknown) => ({ data, error: null });
/** Linha de get_seller_link: link ativo (com WhatsApp e expiração) ou inativo (canal desativado). */
const seller = (active: boolean, whatsapp = PHONE) =>
  ok([
    {
      active,
      whatsapp: active ? whatsapp : null,
      link_kind: "link",
      status: active ? "active" : "inactive",
      expires_at: active ? "2026-10-18T15:00:00.000Z" : null,
    },
  ]);
const DB_DOWN = { data: null, error: { message: "fetch failed" } };
const TEMP_CODE = "0123456789abcdef";
const EXPIRES_AT = "2026-10-18T15:00:00.000Z";
/** Linha de get_seller_link para um link temporário. */
const tempLink = (status: string, whatsapp = PHONE) =>
  ok([
    {
      active: status === "active",
      whatsapp: status === "active" ? whatsapp : null,
      link_kind: "link",
      status,
      expires_at: status === "active" ? EXPIRES_AT : null,
    },
  ]);

afterEach(() => vi.restoreAllMocks());

describe("código e link", () => {
  it("aceita só códigos no formato gerado pelo banco", () => {
    expect(isSellerCode(CODE)).toBe(true);
    for (const bad of ["", "abc", "A1B2C3D4E5F6", "a1b2c3d4-e5f6", "5562999998888".padEnd(33, "0"), null]) {
      expect(isSellerCode(bad)).toBe(false);
    }
    expect(normalizeSellerCode(" A1B2C3D4E5F6%20")).toBe(CODE);
    expect(normalizeSellerCode("%E0%A4%A")).toBeNull();
    expect(normalizeSellerCode("../painel")).toBeNull();
  });

  it("monta o link a partir da origem do site", () => {
    expect(sellerLinkUrl("https://brunoebenicio.com.br", CODE)).toBe(`https://brunoebenicio.com.br/p/${CODE}`);
  });

  it("lê o código do cookie, ignorando outros cookies e valores adulterados", () => {
    expect(readSellerCookie(`a=1; bb_vendedor=${CODE}; b=2`)).toBe(CODE);
    expect(readSellerCookie("bb_vendedor=%3Cscript%3E")).toBeNull();
    expect(readSellerCookie("bb_vendedor=abc")).toBeNull();
    expect(readSellerCookie("")).toBeNull();
  });
});

describe("repositório de vendedores", () => {
  it("getSellerLink: inexistente → null; status desconhecido nunca libera nem devolve número", async () => {
    expect(await getSellerLink(createFakeSupabase([ok([])]).client, CODE)).toBeNull();
    expect(await getSellerLink(createFakeSupabase([ok([{ active: false, whatsapp: PHONE }])]).client, CODE)).toEqual({
      status: "inactive",
      active: false,
      whatsapp: null,
      expiresAt: null,
    });
  });

  it("getSellerLink: link temporário ativo traz a expiração; expirado/desativado não traz número nem prazo", async () => {
    expect(await getSellerLink(createFakeSupabase([tempLink("active")]).client, TEMP_CODE)).toEqual({
      status: "active",
      active: true,
      whatsapp: PHONE,
      expiresAt: EXPIRES_AT,
    });
    for (const status of ["expired", "revoked", "inactive", "invalid"]) {
      expect(await getSellerLink(createFakeSupabase([tempLink(status)]).client, TEMP_CODE)).toEqual({
        status,
        active: false,
        whatsapp: null,
        expiresAt: null,
      });
    }
    // active = true com status diferente de "active" nunca libera.
    const mismatch = ok([{ active: true, whatsapp: PHONE, link_kind: "link", status: "expired", expires_at: EXPIRES_AT }]);
    expect(await getSellerLink(createFakeSupabase([mismatch]).client, TEMP_CODE)).toMatchObject({ active: false, whatsapp: null });
  });
});

describe("resolveSellerLink (abertura de /r/<código>)", () => {
  it("vendedor ativo: associa o código do link", async () => {
    const { client, calls } = createFakeSupabase([seller(true)]);
    expect(await resolveSellerLink(client, CODE)).toEqual({ status: "ok", code: CODE, expiresAt: EXPIRES_AT });
    expect(calls).toEqual([["rpc", "get_seller_link", { p_code: CODE }]]);
  });

  it("cada link válido resolve para o próprio vendedor (o último aberto prevalece)", async () => {
    expect(await resolveSellerLink(createFakeSupabase([seller(true)]).client, OTHER_CODE)).toEqual({
      status: "ok",
      code: OTHER_CODE,
      expiresAt: EXPIRES_AT,
    });
  });

  it("malformado, inexistente, inativo e banco fora do ar são tratados sem associar ninguém", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const malformed = createFakeSupabase();
    expect(await resolveSellerLink(malformed.client, "abc")).toEqual({ status: "invalid", reason: "malformado" });
    expect(malformed.calls).toHaveLength(0);
    expect(await resolveSellerLink(createFakeSupabase([ok([])]).client, CODE)).toEqual({
      status: "invalid",
      reason: "inexistente",
    });
    // Link existente mas sem WhatsApp disponível: site público, sem página de erro.
    expect(await resolveSellerLink(createFakeSupabase([seller(false)]).client, CODE)).toEqual({ status: "public" });
    expect(await resolveSellerLink(createFakeSupabase([DB_DOWN]).client, CODE)).toEqual({
      status: "invalid",
      reason: "indisponivel",
    });
    const noEnv = () => {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL ausente");
    };
    expect(await resolveSellerLink(noEnv, CODE)).toEqual({ status: "invalid", reason: "indisponivel" });
  });
});

describe("resolveSellerLink com link temporário", () => {
  it("válido: associa o código até a expiração", async () => {
    expect(await resolveSellerLink(createFakeSupabase([tempLink("active")]).client, TEMP_CODE)).toEqual({
      status: "ok",
      code: TEMP_CODE,
      expiresAt: EXPIRES_AT,
    });
  });

  it("expirado, desativado ou de vendedor inativo: versão pública (sem página de erro)", async () => {
    for (const status of ["expired", "revoked", "inactive"]) {
      expect(await resolveSellerLink(createFakeSupabase([tempLink(status)]).client, TEMP_CODE), status).toEqual({
        status: "public",
      });
    }
  });

  it("sem preços (inconsistente): versão pública e erro registrado", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await resolveSellerLink(createFakeSupabase([tempLink("invalid")]).client, TEMP_CODE)).toEqual({ status: "public" });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("sem preços"), TEMP_CODE);
  });
});

describe("loadCommercialAccess (versão comercial de NOSSO SHOW)", () => {
  it("vendedor ativo: modelos com valor, lidos pela função comercial com o código do cookie", async () => {
    const { client, calls } = createFakeSupabase([seller(true), ok([{ ...MODEL, price: "1500.00" }])]);
    expect(await loadCommercialAccess(() => client, CODE)).toEqual({
      status: "commercial",
      models: [{ ...MODEL, price: 1500 }],
      expiresInMs: expect.any(Number),
    });
    expect(calls).toEqual([
      ["rpc", "get_seller_link", { p_code: CODE }],
      ["rpc", "get_commercial_show_models", { p_code: CODE }],
    ]);
  });

  it("sem link comercial: versão pública, sem consultar o banco", async () => {
    for (const code of [null, undefined, "", "abc", "+5562999998888", "A1B2C3D4E5F6"]) {
      const { client, calls } = createFakeSupabase();
      expect(await loadCommercialAccess(() => client, code)).toEqual({ status: "none" });
      expect(calls).toHaveLength(0);
    }
  });

  it("vendedor desativado ou inexistente: nenhum valor é liberado", async () => {
    expect(await loadCommercialAccess(() => createFakeSupabase([seller(false), ok([])]).client, CODE)).toEqual({
      status: "inactive",
    });
    expect(await loadCommercialAccess(() => createFakeSupabase([ok([]), ok([])]).client, CODE)).toEqual({
      status: "inactive",
    });
  });

  it("banco fora do ar: erro tratado, sem valores", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await loadCommercialAccess(() => createFakeSupabase([DB_DOWN, DB_DOWN]).client, CODE)).toEqual({
      status: "error",
    });
  });

  it("link temporário válido: preços do link e quanto falta para expirar (relógio do servidor)", async () => {
    const now = () => Date.parse(EXPIRES_AT) - 90_000;
    const { client, calls } = createFakeSupabase([tempLink("active"), ok([{ ...MODEL, price: 1234.5 }])]);
    expect(await loadCommercialAccess(() => client, TEMP_CODE, now)).toEqual({
      status: "commercial",
      models: [{ ...MODEL, price: 1234.5 }],
      expiresInMs: 90_000,
    });
    expect(calls).toEqual([
      ["rpc", "get_seller_link", { p_code: TEMP_CODE }],
      ["rpc", "get_commercial_show_models", { p_code: TEMP_CODE }],
    ]);
  });

  it("link temporário expirado: expired; desativado ou vendedor inativo: inactive; nada de valores", async () => {
    expect(await loadCommercialAccess(() => createFakeSupabase([tempLink("expired"), ok([])]).client, TEMP_CODE)).toEqual({
      status: "expired",
    });
    for (const status of ["revoked", "inactive"]) {
      expect(await loadCommercialAccess(() => createFakeSupabase([tempLink(status), ok([])]).client, TEMP_CODE)).toEqual({
        status: "inactive",
      });
    }
  });
});

describe("prepareWhatsAppReturn (Voltar ao WhatsApp)", () => {
  const request = { modelId: MODEL_ID, name: MODEL.name, price: MODEL.price };
  const run = (responses: { data: unknown; error: unknown }[], code: string | null = CODE, input: unknown = request) => {
    const fake = createFakeSupabase(responses);
    return { fake, result: prepareWhatsAppReturn(() => fake.client, code, input) };
  };

  it("monta o link do vendedor do cookie com o nome e o valor do modelo", async () => {
    const { fake, result } = run([seller(true), ok([MODEL])]);
    const outcome = await result;
    expect(outcome.status).toBe("ready");
    const url = new URL((outcome as { url: string }).url);
    expect(url.origin + url.pathname).toBe(`https://wa.me/${PHONE}`);
    const text = url.searchParams.get("text")!;
    expect(text).toContain("Modelo de show escolhido: Voz e violão");
    expect(text).toContain("Valor apresentado: R$ 1.500,00");
    expect(fake.calls).toEqual([
      ["rpc", "get_seller_link", { p_code: CODE }],
      ["rpc", "get_commercial_show_models", { p_code: CODE }],
    ]);
  });

  const textOf = async (input: unknown) => {
    const outcome = await run([seller(true), ok([MODEL])], CODE, input).result;
    expect(outcome.status).toBe("ready");
    return new URL((outcome as { url: string }).url).searchParams.get("text")!;
  };

  it("data e horário entram só quando informados, sem linhas vazias no lugar", async () => {
    const both = await textOf({ ...request, date: "2026-12-20", time: "21:30" });
    expect(both).toBe(
      [
        "Modelo de show escolhido: Voz e violão",
        "Valor apresentado: R$ 1.500,00",
        "Data do evento: 20/12/2026",
        "Horário do evento: 21:30",
        "",
        "Gostaria de dar continuidade à negociação.",
      ].join("\n"),
    );

    const onlyTime = await textOf({ ...request, date: "", time: "08:00" });
    expect(onlyTime).not.toContain("Data do evento");
    expect(onlyTime).toContain("Valor apresentado: R$ 1.500,00\nHorário do evento: 08:00\n\nGostaria");

    const onlyDate = await textOf({ ...request, date: "2027-01-05", time: null });
    expect(onlyDate).toContain("Data do evento: 05/01/2027\n\nGostaria");
    expect(onlyDate).not.toContain("Horário");

    const none = await textOf(request);
    expect(none).toContain("Valor apresentado: R$ 1.500,00\n\nGostaria");
    expect(none).not.toMatch(/\n\n\n/);
  });

  it("data/horário inválidos: nenhuma URL e mensagem para corrigir", async () => {
    for (const schedule of [
      { date: "2026-02-30" },
      { date: "20/12/2026" },
      { date: 20261220 },
      { time: "25:00" },
      { time: "9h" },
    ]) {
      const { fake, result } = run([], CODE, { ...request, ...schedule });
      expect(await result, JSON.stringify(schedule)).toMatchObject({ status: "error", reason: "invalid-schedule" });
      expect(fake.calls).toHaveLength(0);
    }
  });

  it("acentos, vírgulas, & e quebras de linha chegam intactos ao WhatsApp (URL codificada)", async () => {
    const special = { ...MODEL, name: "Voz, violão & sanfona #1 (100%)" };
    const outcome = await run([seller(true), ok([special])], CODE, { ...request, name: special.name }).result;
    const url = (outcome as { url: string }).url;
    // Nada cru na URL: espaços e quebras de linha só codificados.
    expect(url).not.toMatch(/[ \n]/);
    expect(url).toContain("%0A");
    expect(url).toContain("viol%C3%A3o%20%26%20sanfona%20%231%20(100%25)");
    expect(new URL(url).searchParams.get("text")).toContain("Modelo de show escolhido: Voz, violão & sanfona #1 (100%)");
  });

  it("cada vendedor recebe no próprio número", async () => {
    const other = "5511987654321";
    const outcome = await run([seller(true, other), ok([MODEL])], OTHER_CODE).result;
    expect((outcome as { url: string }).url.startsWith(`https://wa.me/${other}?text=`)).toBe(true);
  });

  it("sem modelo escolhido ou com dados adulterados: nenhuma URL", async () => {
    for (const input of [null, {}, { ...request, modelId: "x" }, { ...request, price: "1500" }, { ...request, price: 0 }]) {
      const { fake, result } = run([], CODE, input);
      expect(await result).toMatchObject({ status: "error", reason: "invalid" });
      expect(fake.calls).toHaveLength(0);
    }
  });

  it("sem link comercial: não abre contato nenhum", async () => {
    for (const code of [null, "", "abc", "https://wa.me/5562999998888"]) {
      const { fake, result } = run([], code);
      expect(await result).toMatchObject({ status: "error", reason: "no-seller" });
      expect(fake.calls).toHaveLength(0);
    }
  });

  it("vendedor desativado ou inexistente depois de abrir o link: bloqueado", async () => {
    expect(await run([seller(false), ok([MODEL])]).result).toMatchObject({ reason: "seller-inactive" });
    expect(await run([ok([]), ok([MODEL])]).result).toMatchObject({ reason: "seller-inactive" });
  });

  it("modelo desativado, renomeado ou com preço alterado: pede para atualizar a página", async () => {
    // Antes de responder, o link é reconferido (terceira resposta).
    expect(await run([seller(true), ok([]), seller(true)]).result).toMatchObject({ reason: "model-unavailable" });
    expect(await run([seller(true), ok([{ ...MODEL, price: 1600 }]), seller(true)]).result).toMatchObject({ reason: "model-changed" });
    expect(await run([seller(true), ok([{ ...MODEL, name: "Outro" }]), seller(true)]).result).toMatchObject({ reason: "model-changed" });
    expect(await run([seller(true), ok([{ ...MODEL, price: 1500.0 }])]).result).toMatchObject({ status: "ready" });
  });

  it("banco fora do ar: erro tratado, com nova tentativa possível", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await run([DB_DOWN, ok([MODEL])]).result).toMatchObject({ status: "error", reason: "unavailable" });
  });
});

describe("prepareWhatsAppReturn com link temporário", () => {
  const LINK_PRICE = 1234.56;
  const LINK_MODEL = { ...MODEL, price: LINK_PRICE };
  const request = { modelId: MODEL_ID, name: MODEL.name, price: LINK_PRICE };
  const run = (responses: { data: unknown; error: unknown }[], input: unknown = request) => {
    const fake = createFakeSupabase(responses);
    return { fake, result: prepareWhatsAppReturn(() => fake.client, TEMP_CODE, input) };
  };

  it("usa o preço gravado no link na mensagem e o WhatsApp do cadastro do vendedor", async () => {
    const outcome = await run([tempLink("active"), ok([LINK_MODEL])]).result;
    expect(outcome.status).toBe("ready");
    const url = new URL((outcome as { url: string }).url);
    expect(url.pathname).toBe("/" + PHONE);
    expect(url.searchParams.get("text")).toContain("Valor apresentado: R$ 1.234,56");
  });

  it("preço adulterado no navegador (ex.: o padrão no lugar do negociado): recusado", async () => {
    for (const price of [MODEL.price, 1, LINK_PRICE + 0.01]) {
      expect(await run([tempLink("active"), ok([LINK_MODEL]), tempLink("active")], { ...request, price }).result, String(price)).toMatchObject({
        status: "error",
        reason: "model-changed",
      });
    }
  });

  it("link expirado: bloqueado com mensagem de proposta expirada (não de formato alterado)", async () => {
    const outcome = await run([tempLink("expired"), ok([])]).result;
    expect(outcome).toMatchObject({ status: "error", reason: "link-expired" });
    expect((outcome as { message: string }).message).toMatch(/proposta expirou/);
  });

  it("link desativado ou vendedor inativo: bloqueado", async () => {
    for (const status of ["revoked", "inactive"]) {
      expect(await run([tempLink(status), ok([])]).result, status).toMatchObject({ reason: "seller-inactive" });
    }
  });

  it("expirou entre as duas leituras (página aberta): reconfere o link e responde expirado", async () => {
    const { fake, result } = run([tempLink("active"), ok([]), tempLink("expired")]);
    expect(await result).toMatchObject({ reason: "link-expired" });
    expect(fake.calls.filter(([, fn]) => fn === "get_seller_link")).toHaveLength(2);
  });

  it("modelo realmente desativado (link ainda válido): formato indisponível", async () => {
    expect(await run([tempLink("active"), ok([]), tempLink("active")]).result).toMatchObject({ reason: "model-unavailable" });
  });
});
