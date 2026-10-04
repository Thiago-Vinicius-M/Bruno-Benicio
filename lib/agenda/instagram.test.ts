import { describe, expect, it } from "vitest";
import { instagramProfileUrl, normalizeInstagramHandle } from "./instagram";

describe("normalizeInstagramHandle", () => {
  it.each([
    ["casaexemplo", "casaexemplo"],
    ["@CasaExemplo", "casaexemplo"],
    ["  casa.exemplo_2  ", "casa.exemplo_2"],
    ["https://instagram.com/casaexemplo", "casaexemplo"],
    ["https://www.instagram.com/CasaExemplo/?hl=pt-br", "casaexemplo"],
    ["instagram.com/casaexemplo", "casaexemplo"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeInstagramHandle(input)).toBe(expected);
  });

  it("vazio vira null (campo opcional)", () => {
    expect(normalizeInstagramHandle("")).toBeNull();
    expect(normalizeInstagramHandle("   ")).toBeNull();
    expect(normalizeInstagramHandle(null)).toBeNull();
  });

  it("rejeita valores que não são username", () => {
    expect(() => normalizeInstagramHandle("casa exemplo")).toThrow(/Instagram inválido/);
    expect(() => normalizeInstagramHandle("a".repeat(31))).toThrow(/Instagram inválido/);
  });

  it("gera o link do perfil para a apresentação", () => {
    expect(instagramProfileUrl("casaexemplo")).toBe("https://www.instagram.com/casaexemplo/");
  });
});
