import { describe, expect, it } from "vitest";
import { currentMonthRange, isIsoDate, isTimeOfDay, periodRange } from "./dates";

describe("currentMonthRange", () => {
  it("29/09/2026 mostra de 01/09 a 30/09", () => {
    expect(currentMonthRange(new Date("2026-09-29T15:00:00-03:00"))).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("vira sozinho para outubro", () => {
    expect(currentMonthRange(new Date("2026-10-01T08:00:00-03:00"))).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("usa o fuso de São Paulo, não o do servidor (UTC já é outubro, SP ainda é setembro)", () => {
    expect(currentMonthRange(new Date("2026-10-01T02:00:00Z"))).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("fevereiro de ano bissexto", () => {
    expect(currentMonthRange(new Date("2028-02-10T12:00:00-03:00"))).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
});

describe("periodRange", () => {
  it("semana ISO: segunda a domingo (igual ao date_trunc('week') do SQL)", () => {
    // 29/09/2026 é terça-feira.
    expect(periodRange("week", new Date("2026-09-29T12:00:00-03:00"))).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    // Domingo pertence à semana que começou na segunda anterior.
    expect(periodRange("week", new Date("2026-10-04T12:00:00-03:00"))).toEqual({ from: "2026-09-28", to: "2026-10-04" });
  });

  it("ano", () => {
    expect(periodRange("year", new Date("2026-09-29T12:00:00-03:00"))).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });
});

describe("validação de data/hora", () => {
  it("aceita datas reais e rejeita impossíveis", () => {
    expect(isIsoDate("2026-09-30")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("30/09/2026")).toBe(false);
  });

  it("aceita HH:MM e HH:MM:SS em 24h", () => {
    expect(isTimeOfDay("21:00")).toBe(true);
    expect(isTimeOfDay("23:59:59")).toBe(true);
    expect(isTimeOfDay("24:00")).toBe(false);
    expect(isTimeOfDay("9h")).toBe(false);
  });
});
