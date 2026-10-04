import { describe, expect, it } from "vitest";
import { createFinancialEntry, deleteFinancialEntry, getFinancialReport, summarizeReport } from "./financialRepository";
import { getCurrentMonthAgenda } from "./publicAgenda";
import { createShow, listShows, softDeleteShow, toShowRow, updateShow } from "./showsRepository";
import { createFakeSupabase } from "./testing/fakeSupabase";
import type { FinancialReportRow } from "./types";

const ok = (data: unknown) => ({ data, error: null });
const argsOf = (calls: unknown[][], method: string) => calls.filter(([m]) => m === method).map(([, ...args]) => args);

describe("showsRepository", () => {
  it("cria show enviando só dados públicos normalizados — nunca campos de auditoria", async () => {
    const { client, calls } = createFakeSupabase([ok({ id: "s1" })]);
    await createShow(client, {
      showDate: "2026-09-10",
      showTime: "21:00",
      venueName: "  Bar do Centro ",
      venueInstagram: "https://instagram.com/BarDoCentro",
    });
    expect(argsOf(calls, "insert")).toEqual([
      [{ show_date: "2026-09-10", show_time: "21:00", venue_name: "Bar do Centro", venue_instagram: "bardocentro" }],
    ]);
  });

  it("valida antes de chamar o banco", () => {
    expect(() => toShowRow({ showDate: "2026-02-30", showTime: "21:00", venueName: "Bar" })).toThrow(/Data/);
    expect(() => toShowRow({ showDate: "2026-09-10", showTime: "25:00", venueName: "Bar" })).toThrow(/Horário/);
    expect(() => toShowRow({ showDate: "2026-09-10", showTime: "21:00", venueName: "  " })).toThrow(/local/);
  });

  it("edição parcial só envia o que mudou e ignora shows excluídos", async () => {
    const { client, calls } = createFakeSupabase([ok({ id: "s1" })]);
    await updateShow(client, "s1", { venueName: "Novo Bar" });
    expect(argsOf(calls, "update")).toEqual([[{ venue_name: "Novo Bar" }]]);
    expect(argsOf(calls, "is")).toEqual([["deleted_at", null]]);
  });

  it("soft delete é um UPDATE em show ativo (nunca DELETE)", async () => {
    const { client, calls } = createFakeSupabase([ok({ id: "s1" })]);
    await softDeleteShow(client, "s1");
    expect(calls.some(([m]) => m === "delete")).toBe(false);
    expect(Object.keys(argsOf(calls, "update")[0][0] as object)).toEqual(["deleted_at"]);
    expect(argsOf(calls, "is")).toEqual([["deleted_at", null]]);
  });

  it("soft delete de show inexistente/já excluído vira NOT_FOUND", async () => {
    const { client } = createFakeSupabase([{ data: null, error: { code: "PGRST116", message: "0 rows" } }]);
    await expect(softDeleteShow(client, "s1")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("listagem padrão traz só ativos; lixeira traz só excluídos", async () => {
    const active = createFakeSupabase([ok([])]);
    await listShows(active.client, { range: { from: "2026-09-01", to: "2026-09-30" } });
    expect(argsOf(active.calls, "is")).toEqual([["deleted_at", null]]);
    expect(argsOf(active.calls, "gte")).toEqual([["show_date", "2026-09-01"]]);

    const trash = createFakeSupabase([ok([])]);
    await listShows(trash.client, { status: "deleted" });
    expect(argsOf(trash.calls, "not")).toEqual([["deleted_at", "is", null]]);
  });

  it("violação de RLS vira FORBIDDEN sem vazar a mensagem do banco", async () => {
    const { client } = createFakeSupabase([
      { data: null, error: { code: "42501", message: 'new row violates row-level security policy for table "shows"' } },
    ]);
    const error = await createShow(client, { showDate: "2026-09-10", showTime: "21:00", venueName: "Bar" }).catch((e) => e);
    expect(error).toMatchObject({ code: "FORBIDDEN", message: "Você não tem permissão para esta operação." });
  });
});

describe("financialRepository", () => {
  it("despesa é lançada com valor positivo; negativo é recusado", async () => {
    const { client, calls } = createFakeSupabase([ok({ id: "e1" })]);
    await createFinancialEntry(client, { showId: "s1", type: "EXPENSE", description: " Comissão ", amount: 50 });
    expect(argsOf(calls, "insert")).toEqual([[{ show_id: "s1", type: "EXPENSE", description: "Comissão", amount: 50 }]]);

    await expect(createFinancialEntry(client, { showId: "s1", type: "EXPENSE", amount: -50 })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("aceita valor zero e recusa mais de 2 casas decimais", async () => {
    const { client } = createFakeSupabase([ok({ id: "e1" })]);
    await expect(createFinancialEntry(client, { showId: "s1", type: "CACHE", amount: 0 })).resolves.toBeTruthy();
    await expect(createFinancialEntry(client, { showId: "s1", type: "CACHE", amount: 10.005 })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("EDITOR tentando excluir lançamento: nenhuma linha afetada vira NOT_FOUND", async () => {
    const { client } = createFakeSupabase([ok([])]);
    await expect(deleteFinancialEntry(client, "e1")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("EDITOR pedindo relatório recebe FORBIDDEN (erro 42501 do banco)", async () => {
    const { client, calls } = createFakeSupabase([
      { data: null, error: { code: "42501", message: "Somente ADMIN pode acessar relatórios financeiros." } },
    ]);
    await expect(getFinancialReport(client, { from: "2026-09-01", to: "2026-09-30" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(argsOf(calls, "rpc")).toEqual([
      ["get_financial_report", { p_from: "2026-09-01", p_to: "2026-09-30", p_group_by: "month" }],
    ]);
  });

  it("resume o período somando os grupos sem erro de ponto flutuante", () => {
    const row = (net: number, cache: number, other: number, expense: number): FinancialReportRow => ({
      period_start: "2026-09-07",
      show_count: 1,
      entry_count: 3,
      cache_total: cache,
      other_revenue_total: other,
      expense_total: expense,
      net_total: net,
    });
    expect(summarizeReport([row(0.3, 0.1, 0.2, 0), row(0.3, 0.1, 0.2, 0)])).toEqual({
      showCount: 2,
      entryCount: 6,
      cacheTotal: 0.2,
      otherRevenueTotal: 0.4,
      expenseTotal: 0,
      netTotal: 0.6,
    });
  });
});

describe("agenda pública", () => {
  it("consulta somente get_public_agenda com o mês corrente — nunca tabelas", async () => {
    const { client, calls } = createFakeSupabase([ok([])]);
    await getCurrentMonthAgenda(client, new Date("2026-09-29T12:00:00-03:00"));
    expect(calls).toEqual([["rpc", "get_public_agenda", { p_from: "2026-09-01", p_to: "2026-09-30" }]]);
  });
});
