import { describe, expect, it } from "vitest";
import { agendaNow } from "@/lib/agenda/dates";
import { formatShowDate, formatShowTime, isPastShow, monthKey, monthLabel, showDateParts } from "./showFormat";

describe("datas de calendário (sem fuso)", () => {
  it("05/10 continua 05/10 (não vira 04/10 nem 06/10)", () => {
    expect(formatShowDate("2026-10-05")).toBe("05/10/2026");
    expect(showDateParts("2026-10-05")).toEqual({ day: "05", month: "out", year: 2026, weekday: "seg" });
    // Primeiro e último dia do mês: onde o deslocamento de fuso costuma aparecer.
    expect(showDateParts("2026-10-01").day).toBe("01");
    expect(showDateParts("2026-10-31")).toMatchObject({ day: "31", month: "out" });
    expect(showDateParts("2026-12-31")).toMatchObject({ day: "31", month: "dez", year: 2026 });
  });

  it("horário mantém o valor digitado", () => {
    expect(formatShowTime("21:30:00")).toBe("21:30");
    expect(formatShowTime("21:30")).toBe("21:30");
  });

  it("agrupamento por mês", () => {
    expect(monthKey("2026-10-05")).toBe("2026-10");
    expect(monthLabel("2026-10")).toBe("Outubro 2026");
  });
});

describe("agora no fuso da banda", () => {
  it("usa São Paulo, não o fuso do servidor", () => {
    expect(agendaNow(new Date("2026-10-01T01:15:00Z"))).toEqual({ date: "2026-09-30", time: "22:15" });
    expect(agendaNow(new Date("2026-10-01T03:00:00Z"))).toEqual({ date: "2026-10-01", time: "00:00" });
  });

  it("show passado considera data e horário", () => {
    const now = { date: "2026-10-05", time: "21:00" };
    expect(isPastShow({ show_date: "2026-10-04", show_time: "23:00:00" }, now)).toBe(true);
    expect(isPastShow({ show_date: "2026-10-05", show_time: "20:59:00" }, now)).toBe(true);
    expect(isPastShow({ show_date: "2026-10-05", show_time: "21:00:00" }, now)).toBe(false);
    expect(isPastShow({ show_date: "2026-10-06", show_time: "00:00:00" }, now)).toBe(false);
  });
});
