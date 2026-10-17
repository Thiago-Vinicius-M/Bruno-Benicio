import { describe, expect, it } from "vitest";
import type { CommercialLink } from "./types";
import { groupLinks, linkPeriodRange, matchesLinkSearch } from "./linkGroups";

const NOW = new Date("2026-10-17T18:00:00Z"); // 15:00 em Brasília

describe("período dos links (calendário de Brasília)", () => {
  it("este mês, mês passado e últimos 30 dias", () => {
    // 17/10/2026 é sábado: semana de segunda (12) a domingo (18).
    expect(linkPeriodRange("week", NOW)).toEqual({ from: "2026-10-12", to: "2026-10-18" });
    expect(linkPeriodRange("month", NOW)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(linkPeriodRange("lastMonth", NOW)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(linkPeriodRange("30d", NOW)).toEqual({ from: "2026-09-18", to: "2026-10-17" });
  });

  it("semana que atravessa o mês: segunda de um mês, domingo do outro", () => {
    expect(linkPeriodRange("week", new Date("2026-11-01T15:00:00Z"))).toEqual({ from: "2026-10-26", to: "2026-11-01" });
  });

  it("virada de mês e de ano no fuso de Brasília", () => {
    // 01/11 02:00 UTC = 31/10 23:00 em Brasília: ainda outubro.
    expect(linkPeriodRange("month", new Date("2026-11-01T02:00:00Z"))).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(linkPeriodRange("lastMonth", new Date("2027-01-10T12:00:00Z"))).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("personalizado: datas reais e início antes do fim", () => {
    expect(linkPeriodRange("custom", NOW, { from: "2026-09-15", to: "2026-10-03" })).toEqual({ from: "2026-09-15", to: "2026-10-03" });
    expect(linkPeriodRange("custom", NOW, { from: "2026-10-03", to: "2026-10-03" })).toEqual({ from: "2026-10-03", to: "2026-10-03" });
    expect(linkPeriodRange("custom", NOW, { from: "2026-10-04", to: "2026-10-03" })).toBeNull();
    expect(linkPeriodRange("custom", NOW, { from: "2026-02-30", to: "2026-03-03" })).toBeNull();
    expect(linkPeriodRange("custom", NOW, {})).toBeNull();
  });
});

describe("busca pelo nome do evento", () => {
  it("ignora maiúsculas, acentos e espaços; sem nome só aparece com busca vazia", () => {
    expect(matchesLinkSearch({ label: "Casamento João e Maria" }, "joao")).toBe(true);
    expect(matchesLinkSearch({ label: "Casamento João e Maria" }, "  CASAMENTO   joão ")).toBe(true);
    expect(matchesLinkSearch({ label: "Formatura" }, "casamento")).toBe(false);
    expect(matchesLinkSearch({ label: null }, "")).toBe(true);
    expect(matchesLinkSearch({ label: null }, "x")).toBe(false);
  });
});

describe("seções", () => {
  const link = (id: string, created: string, status: CommercialLink["status"], label: string) =>
    ({ id, created_at: created, status, label }) as CommercialLink;
  const LINKS = [
    link("a", "2026-08-01T15:00:00Z", "active", "Casamento antigo"),
    link("b", "2026-08-01T15:00:00Z", "expired", "Casamento expirado"),
    link("c", "2026-10-05T15:00:00Z", "revoked", "Formatura"),
  ];
  const ids = (groups: ReturnType<typeof groupLinks>) => ({
    active: groups.active.map((l) => l.id),
    expired: groups.expired.map((l) => l.id),
    revoked: groups.revoked.map((l) => l.id),
  });

  it("o período vale para as três seções (inclusive os ativos)", () => {
    expect(ids(groupLinks(LINKS, { from: "2026-10-01", to: "2026-10-31" }))).toEqual({ active: [], expired: [], revoked: ["c"] });
    expect(ids(groupLinks(LINKS, { from: "2026-08-01", to: "2026-08-31" }))).toEqual({ active: ["a"], expired: ["b"], revoked: [] });
  });

  it("busca filtra as três seções", () => {
    expect(ids(groupLinks(LINKS, null, "casamento"))).toEqual({ active: ["a"], expired: ["b"], revoked: [] });
    expect(ids(groupLinks(LINKS, null, "formatura"))).toEqual({ active: [], expired: [], revoked: ["c"] });
  });
});
