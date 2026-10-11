import { describe, expect, it } from "vitest";
import { isAgendaError } from "@/lib/agenda/errors";
import { createFakeSupabase } from "@/lib/agenda/testing/fakeSupabase";
import { buildContractMessage } from "./contractMessage";
import { formatEventDate, parseEventDate, parseEventTime } from "./eventSchedule";
import { toShowModelRow } from "./modelInput";
import { formatPrice, parsePrice, priceInputValue } from "./price";
import { createShowModel, getPublicShowModels, listShowModels, updateShowModel } from "./showModelsRepository";

const plain = (text: string) => text.replace(/\s/g, " ");

describe("preço", () => {
  it("formata em reais com duas casas (convenção brasileira)", () => {
    expect(plain(formatPrice(1500))).toBe("R$ 1.500,00");
    expect(plain(formatPrice(2200.5))).toBe("R$ 2.200,50");
    expect(plain(formatPrice(999999.99))).toBe("R$ 999.999,99");
    expect(priceInputValue(1500.5)).toBe("1.500,50");
  });

  it("entende o valor como digitado no painel", () => {
    expect(parsePrice("1500")).toBe(1500);
    expect(parsePrice("1.500")).toBe(1500);
    expect(parsePrice("1.500,00")).toBe(1500);
    expect(parsePrice("1500,5")).toBe(1500.5);
    expect(parsePrice("1500.50")).toBe(1500.5);
    expect(parsePrice("R$ 12.345,67")).toBe(12345.67);
    expect(parsePrice(formatPrice(3000))).toBe(3000);
    expect(parsePrice(1800)).toBe(1800);
  });

  it("recusa vazio, zero, negativo, texto e mais de 2 casas", () => {
    for (const raw of ["", "0", "0,00", "-10", "abc", "1,505", "1.50.0", "15,00,00", "1.5000", "1e3", "100000000"]) {
      expect(parsePrice(raw), raw).toBeNull();
    }
    expect(parsePrice(10.005)).toBeNull();
    expect(parsePrice(Number.NaN)).toBeNull();
  });
});

describe("data e horário do evento", () => {
  it("vazios são válidos (campos opcionais)", () => {
    for (const raw of ["", "  ", null, undefined]) {
      expect(parseEventDate(raw)).toEqual({ ok: true, value: null });
      expect(parseEventTime(raw)).toEqual({ ok: true, value: null });
    }
  });

  it("data: só datas reais do calendário, sem regra de antecedência", () => {
    expect(parseEventDate("2028-02-29")).toEqual({ ok: true, value: "2028-02-29" });
    expect(parseEventDate("2020-01-10")).toEqual({ ok: true, value: "2020-01-10" });
    for (const raw of ["2027-02-29", "2026-13-01", "2026-04-31", "2026-00-10", "20/12/2026", "2026-1-5", 5]) {
      expect(parseEventDate(raw).ok, String(raw)).toBe(false);
    }
    expect(formatEventDate("2026-03-07")).toBe("07/03/2026");
  });

  it("horário: HH:MM (segundos do campo nativo são descartados)", () => {
    expect(parseEventTime("21:30")).toEqual({ ok: true, value: "21:30" });
    expect(parseEventTime("07:05:00")).toEqual({ ok: true, value: "07:05" });
    for (const raw of ["24:00", "7:05", "21h", "12:60", "abc", 2130]) {
      expect(parseEventTime(raw).ok, String(raw)).toBe(false);
    }
  });
});

describe("toShowModelRow", () => {
  it("normaliza os campos do formulário", () => {
    expect(
      toShowModelRow({ name: "  Voz   e violão ", duration: " 2h30 de show ", description: "  ", price: "1.500,00" }),
    ).toEqual({ name: "Voz e violão", duration: "2h30 de show", description: null, price: 1500 });
  });

  it("campos obrigatórios e valor válido, com mensagens para o usuário", () => {
    const problem = (input: Parameters<typeof toShowModelRow>[0]) => {
      try {
        toShowModelRow(input);
        return null;
      } catch (error) {
        return isAgendaError(error) ? error.message : String(error);
      }
    };
    expect(problem({ name: "", duration: "1h", price: "10" })).toMatch(/nome/);
    expect(problem({ name: "X", duration: "", price: "10" })).toMatch(/duração/);
    expect(problem({ name: "X", duration: "1h", price: "0" })).toMatch(/valor válido/);
    expect(problem({ name: "X".repeat(81), duration: "1h", price: "10" })).toMatch(/longo/);
    expect(problem({ name: "X", duration: "1h", description: "d".repeat(281), price: "10" })).toMatch(/Descrição/);
  });
});

describe("mensagem do WhatsApp", () => {
  it("intenção, nome do modelo e valor em reais", () => {
    expect(buildContractMessage({ name: "Voz, violão e bateria", price: 1800 })).toBe(
      [
        "Olá! Acessei o portfólio do Bruno e Benício e tenho interesse em contratar a dupla.",
        "",
        "Modelo de show escolhido: Voz, violão e bateria",
        "Valor apresentado: R$ 1.800,00",
        "",
        "Gostaria de dar continuidade à negociação.",
      ].join("\n"),
    );
  });

  it("data e horário opcionais, independentes, sem fuso nem linha vazia sobrando", () => {
    const lines = (schedule: Parameters<typeof buildContractMessage>[1]) =>
      buildContractMessage({ name: "Acústico", price: 990 }, schedule).split("\n");
    expect(lines({ date: "2026-12-31", time: "23:59" })).toEqual(
      expect.arrayContaining(["Data do evento: 31/12/2026", "Horário do evento: 23:59"]),
    );
    expect(lines({ date: "2026-01-01" })).toContain("Data do evento: 01/01/2026");
    expect(lines({ time: "00:00" })).toContain("Horário do evento: 00:00");
    expect(lines({})).toHaveLength(6);
    expect(lines({ date: "2026-01-01", time: "00:00" })).toHaveLength(8);
  });

  it("valor com centavos e espaço comum depois do R$", () => {
    const message = buildContractMessage({ name: "Acústico", price: 1650.75 });
    expect(message).toContain("Valor apresentado: R$ 1.650,75");
    expect(message).not.toContain(String.fromCharCode(160));
  });
});

describe("repositório", () => {
  it("lista na ordem de exibição, com desempate determinístico", async () => {
    const { client, calls } = createFakeSupabase([{ data: [{ id: "a", price: "1500.00" }], error: null }]);
    const rows = await listShowModels(client);
    expect(rows[0].price).toBe(1500);
    expect(calls.filter(([method]) => method === "order").map(([, column]) => column)).toEqual([
      "position",
      "created_at",
      "id",
    ]);
  });

  it("cadastro e edição enviam só os campos do formulário (nada de auditoria ou posição)", async () => {
    const { client, calls } = createFakeSupabase([
      { data: { id: "a", price: 990 }, error: null },
      { data: { id: "a", price: 990 }, error: null },
    ]);
    const input = { name: "Acústico", duration: "1h30", price: "990", active: false };
    await createShowModel(client, input);
    await updateShowModel(client, "a", input);
    expect(calls.find(([method]) => method === "insert")?.[1]).toEqual({
      name: "Acústico",
      duration: "1h30",
      description: null,
      price: 990,
      active: false,
    });
    expect(calls.find(([method]) => method === "update")?.[1]).toEqual({
      name: "Acústico",
      duration: "1h30",
      description: null,
      price: 990,
    });
  });

  it("valor inválido não chega ao banco", async () => {
    const { client, calls } = createFakeSupabase();
    await expect(createShowModel(client, { name: "X", duration: "1h", price: "-1" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect(calls).toHaveLength(0);
  });

  it("site público lê só a função pública e nunca repassa preço; erro do banco vira mensagem amigável", async () => {
    // Mesmo se a função devolvesse um preço (ex.: banco sem a migration nova), ele não sai daqui.
    const ok = createFakeSupabase([
      { data: [{ id: "a", name: "X", duration: "1h", description: null, price: 10 }], error: null },
    ]);
    const models = await getPublicShowModels(ok.client);
    expect(models).toEqual([{ id: "a", name: "X", duration: "1h", description: null }]);
    expect(JSON.stringify(models)).not.toContain("price");
    expect(ok.calls).toEqual([["rpc", "get_public_show_models", undefined]]);

    const down = createFakeSupabase([{ data: null, error: { message: "fetch failed" } }]);
    await expect(getPublicShowModels(down.client)).rejects.toMatchObject({
      message: "Não foi possível carregar os formatos de show.",
    });
  });
});
