import { describe, expect, it } from "vitest";
import { formatWhatsApp, isValidWhatsApp, normalizeWhatsApp, whatsappUrl } from "./whatsapp";

const digits = (raw: string) => {
  const result = normalizeWhatsApp(raw);
  return result.ok ? result.digits : `ERRO: ${result.message}`;
};

describe("normalizeWhatsApp", () => {
  it("remove espaços, parênteses, hífens, pontos e o + (DDI + DDD + número)", () => {
    for (const raw of ["+55 (62) 99999-8888", "55 62 99999 8888", "+55.62.99999.8888", "5562999998888", " 0055 62 99999-8888 "]) {
      expect(digits(raw), raw).toBe("5562999998888");
    }
    expect(digits("+55 62 3222-3333")).toBe("556232223333");
  });

  it("exige o código do país; estrangeiros precisam do +", () => {
    expect(digits("(62) 99999-8888")).toMatch(/código do país/);
    expect(digits("+351 912 345 678")).toBe("351912345678");
    expect(digits("+1 (415) 555-2671")).toBe("14155552671");
  });

  it("recusa número brasileiro incompleto, celular sem o 9 e caracteres estranhos", () => {
    expect(digits("+55 62 9999-888")).toMatch(/brasileiro inválido/);
    expect(digits("+55 62 89999-8888")).toMatch(/brasileiro inválido/);
    expect(digits("+55 (62) 99999-8888 ramal 2")).toMatch(/Use só números/);
    expect(digits("")).toMatch(/Informe/);
    expect(digits("+12345")).toMatch(/inválido/);
  });

  it("isValidWhatsApp segue as mesmas regras do banco", () => {
    expect(isValidWhatsApp("5562999998888")).toBe(true);
    expect(isValidWhatsApp("+5562999998888")).toBe(false);
    expect(isValidWhatsApp("556299999888")).toBe(false);
    expect(isValidWhatsApp(null)).toBe(false);
  });
});

describe("formatWhatsApp e whatsappUrl", () => {
  it("formata para exibição", () => {
    expect(formatWhatsApp("5562999998888")).toBe("+55 (62) 99999-8888");
    expect(formatWhatsApp("556232223333")).toBe("+55 (62) 3222-3333");
    expect(formatWhatsApp("351912345678")).toBe("+351912345678");
  });

  it("link oficial wa.me com a mensagem codificada (acentos, espaços, quebras de linha, R$ e &)", () => {
    const url = whatsappUrl("5562999998888", "Olá!\nValor: R$ 1.500,00 & ação");
    expect(url).toBe(
      "https://wa.me/5562999998888?text=Ol%C3%A1!%0AValor%3A%20R%24%201.500%2C00%20%26%20a%C3%A7%C3%A3o",
    );
    expect(decodeURIComponent(new URL(url).searchParams.get("text")!)).toBe("Olá!\nValor: R$ 1.500,00 & ação");
  });
});
