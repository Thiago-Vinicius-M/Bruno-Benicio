import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type Call } from "@/lib/agenda/testing/fakeSupabase";
import {
  createShowFromInput,
  deleteShowById,
  listAgenda,
  parseAgendaFilter,
  parseShowInput,
  restoreShowById,
  updateShowFromInput,
} from "./agenda";

const SHOW_ID = "11111111-1111-4111-8111-111111111111";
const argsOf = (calls: Call[], method: string) => calls.filter(([m]) => m === method).map(([, ...args]) => args);
const methods = (calls: Call[]) => calls.map(([m]) => m);
const saved = { data: { id: SHOW_ID }, error: null };

// 30/09/2026 22:15 em São Paulo = 01/10/2026 01:15 UTC (servidor em UTC não pode errar o "hoje").
const NOW = new Date("2026-10-01T01:15:00Z");

afterEach(() => vi.restoreAllMocks());

describe("filtros da agenda", () => {
  it("valores desconhecidos caem no padrão (todos os ativos)", () => {
    expect(parseAgendaFilter("proximos")).toBe("proximos");
    expect(parseAgendaFilter("constructor")).toBe("todos");
    expect(parseAgendaFilter(["excluidos"])).toBe("todos");
    expect(parseAgendaFilter(undefined)).toBe("todos");
  });

  it("todos: só ativos, sem limite de mês, em ordem cronológica", async () => {
    const { client, calls } = createFakeSupabase([{ data: [], error: null }]);
    await listAgenda(client, "todos");
    expect(argsOf(calls, "from")).toEqual([["shows"]]);
    expect(argsOf(calls, "is")).toEqual([["deleted_at", null]]);
    expect(argsOf(calls, "gte")).toEqual([]);
    expect(argsOf(calls, "order")).toEqual([
      ["show_date", { ascending: true }],
      ["show_time", { ascending: true }],
      ["venue_name"],
    ]);
  });

  it("próximos: data futura ou hoje com horário ainda por vir (fuso de São Paulo)", async () => {
    const { client, calls } = createFakeSupabase([{ data: [], error: null }]);
    await listAgenda(client, "proximos", NOW);
    expect(argsOf(calls, "is")).toEqual([["deleted_at", null]]);
    expect(argsOf(calls, "or")).toEqual([["show_date.gt.2026-09-30,and(show_date.eq.2026-09-30,show_time.gte.22:15)"]]);
  });

  it("passados: mais recentes primeiro", async () => {
    const { client, calls } = createFakeSupabase([{ data: [], error: null }]);
    await listAgenda(client, "passados", NOW);
    expect(argsOf(calls, "or")).toEqual([["show_date.lt.2026-09-30,and(show_date.eq.2026-09-30,show_time.lt.22:15)"]]);
    expect(argsOf(calls, "order").slice(0, 2)).toEqual([
      ["show_date", { ascending: false }],
      ["show_time", { ascending: false }],
    ]);
  });

  it("excluídos: somente deleted_at preenchido, sem misturar com ativos", async () => {
    const { client, calls } = createFakeSupabase([{ data: [], error: null }]);
    await listAgenda(client, "excluidos");
    expect(argsOf(calls, "not")).toEqual([["deleted_at", "is", null]]);
    expect(argsOf(calls, "is")).toEqual([]);
  });

  it("a agenda nunca consulta o financeiro", async () => {
    for (const filter of ["todos", "proximos", "passados", "excluidos"] as const) {
      const { client, calls } = createFakeSupabase([{ data: [], error: null }]);
      await listAgenda(client, filter, NOW);
      expect(argsOf(calls, "from")).toEqual([["shows"]]);
      expect(JSON.stringify(calls)).not.toMatch(/financial|amount/);
    }
  });
});

describe("entrada do formulário", () => {
  it("descarta campos de auditoria/papel enviados pelo navegador", () => {
    expect(
      parseShowInput({
        showDate: "2026-10-05",
        showTime: "21:30",
        venueName: "Villa Mix",
        venueInstagram: "@villamix",
        created_by: "x",
        deleted_by: "y",
        role: "ADMIN",
      }),
    ).toEqual({ showDate: "2026-10-05", showTime: "21:30", venueName: "Villa Mix", venueInstagram: "@villamix" });
    expect(parseShowInput(null)).toEqual({ showDate: "", showTime: "", venueName: "", venueInstagram: "" });
  });
});

describe("criar show", () => {
  it("dados válidos: data e horário exatamente como digitados, Instagram normalizado", async () => {
    const { client, calls } = createFakeSupabase([saved]);
    const result = await createShowFromInput(client, {
      showDate: "2026-10-05",
      showTime: "21:30",
      venueName: "  Villa Mix ",
      venueInstagram: "https://instagram.com/VillaMix",
      created_by: "forjado",
    });
    expect(result).toEqual({ status: "success", message: "Show criado com sucesso." });
    expect(argsOf(calls, "insert")).toEqual([
      [{ show_date: "2026-10-05", show_time: "21:30", venue_name: "Villa Mix", venue_instagram: "villamix" }],
    ]);
  });

  it("Instagram é opcional (vazio vira null)", async () => {
    const { client, calls } = createFakeSupabase([saved]);
    await createShowFromInput(client, { showDate: "2026-10-05", showTime: "21:00", venueName: "Bar", venueInstagram: "" });
    expect(argsOf(calls, "insert")[0][0]).toMatchObject({ venue_instagram: null });
  });

  it("aceita @usuario e usuario", async () => {
    for (const handle of ["@casadoevento", "casadoevento"]) {
      const { client, calls } = createFakeSupabase([saved]);
      await createShowFromInput(client, { showDate: "2026-10-05", showTime: "21:00", venueName: "Bar", venueInstagram: handle });
      expect(argsOf(calls, "insert")[0][0]).toMatchObject({ venue_instagram: "casadoevento" });
    }
  });

  it("dados inválidos não chegam ao banco", async () => {
    const cases: [object, RegExp][] = [
      [{ showDate: "2026-02-30", showTime: "21:00", venueName: "Bar" }, /Data/],
      [{ showDate: "", showTime: "21:00", venueName: "Bar" }, /Data/],
      [{ showDate: "2026-10-05", showTime: "24:00", venueName: "Bar" }, /Horário/],
      [{ showDate: "2026-10-05", showTime: "21:00", venueName: "   " }, /local/],
      [{ showDate: "2026-10-05", showTime: "21:00", venueName: "x".repeat(161) }, /longo/],
      [{ showDate: "2026-10-05", showTime: "21:00", venueName: "Bar", venueInstagram: "não vale!" }, /Instagram/],
    ];
    for (const [input, message] of cases) {
      const { client, calls } = createFakeSupabase();
      const result = await createShowFromInput(client, input);
      expect(result.status).toBe("error");
      expect(result.message).toMatch(message);
      expect(methods(calls)).not.toContain("insert");
    }
  });

  it("negado pelo RLS vira mensagem de permissão, sem detalhe técnico", async () => {
    const { client } = createFakeSupabase([
      { data: null, error: { code: "42501", message: 'new row violates row-level security policy for table "shows"' } },
    ]);
    const result = await createShowFromInput(client, { showDate: "2026-10-05", showTime: "21:00", venueName: "Bar" });
    expect(result).toEqual({ status: "error", message: "Você não tem permissão para esta operação." });
  });

  it("erro inesperado: mensagem amigável ao usuário e detalhe só no log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = createFakeSupabase([{ data: null, error: { code: "XX000", message: "connection reset by peer" } }]);
    const result = await createShowFromInput(client, { showDate: "2026-10-05", showTime: "21:00", venueName: "Bar" });
    expect(result).toEqual({ status: "error", message: "Não foi possível salvar o show. Tente novamente." });
    expect(JSON.stringify(log.mock.calls)).toContain("connection reset by peer");
  });
});

describe("editar show", () => {
  it("altera data, horário, local e Instagram do show ativo, sem tocar na auditoria", async () => {
    const { client, calls } = createFakeSupabase([saved]);
    const result = await updateShowFromInput(client, SHOW_ID, {
      showDate: "2026-11-12",
      showTime: "22:00",
      venueName: "Casa Y",
      venueInstagram: "@casay",
      updated_by: "forjado",
      created_at: "2000-01-01",
    });
    expect(result).toEqual({ status: "success", message: "Show atualizado com sucesso." });
    expect(argsOf(calls, "update")).toEqual([
      [{ show_date: "2026-11-12", show_time: "22:00", venue_name: "Casa Y", venue_instagram: "casay" }],
    ]);
    expect(argsOf(calls, "eq")).toEqual([["id", SHOW_ID]]);
    expect(argsOf(calls, "is")).toEqual([["deleted_at", null]]);
  });

  it("remover o Instagram grava null", async () => {
    const { client, calls } = createFakeSupabase([saved]);
    await updateShowFromInput(client, SHOW_ID, { showDate: "2026-11-12", showTime: "22:00", venueName: "Casa", venueInstagram: "" });
    expect(argsOf(calls, "update")[0][0]).toMatchObject({ venue_instagram: null });
  });

  it("show excluído (ou inexistente) não é editado", async () => {
    const { client } = createFakeSupabase([{ data: null, error: { code: "PGRST116", message: "0 rows" } }]);
    const result = await updateShowFromInput(client, SHOW_ID, { showDate: "2026-11-12", showTime: "22:00", venueName: "Casa" });
    expect(result).toEqual({ status: "error", message: "Show não encontrado ou já excluído." });
  });

  it("id inválido não chega ao banco", async () => {
    const { client, calls } = createFakeSupabase();
    await expect(updateShowFromInput(client, "1 or 1=1", {})).resolves.toEqual({ status: "error", message: "Show inválido." });
    expect(calls).toEqual([]);
  });
});

describe("excluir e restaurar", () => {
  it("excluir é soft delete: UPDATE de deleted_at em show ativo, nunca DELETE nem deleted_by", async () => {
    const { client, calls } = createFakeSupabase([saved]);
    await expect(deleteShowById(client, SHOW_ID)).resolves.toEqual({ status: "success", message: "Show excluído com sucesso." });
    expect(methods(calls)).not.toContain("delete");
    const [[changes]] = argsOf(calls, "update") as [[Record<string, unknown>]];
    expect(Object.keys(changes)).toEqual(["deleted_at"]);
    expect(argsOf(calls, "is")).toEqual([["deleted_at", null]]);
  });

  it("restaurar limpa deleted_at do mesmo registro (sem criar outro)", async () => {
    const { client, calls } = createFakeSupabase([saved]);
    await expect(restoreShowById(client, SHOW_ID)).resolves.toEqual({
      status: "success",
      message: "Show restaurado com sucesso.",
    });
    expect(argsOf(calls, "update")).toEqual([[{ deleted_at: null }]]);
    expect(argsOf(calls, "eq")).toEqual([["id", SHOW_ID]]);
    expect(methods(calls)).not.toContain("insert");
  });

  it("excluir de novo um show já excluído informa o motivo", async () => {
    const { client } = createFakeSupabase([{ data: null, error: { code: "PGRST116", message: "0 rows" } }]);
    await expect(deleteShowById(client, SHOW_ID)).resolves.toEqual({
      status: "error",
      message: "Show não encontrado ou já excluído.",
    });
  });
});
