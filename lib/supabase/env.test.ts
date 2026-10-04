import { describe, expect, it } from "vitest";
import { isSecretKey, validatePublicEnv } from "./env";

const jwt = (payload: object) => `header.${btoa(JSON.stringify(payload)).replace(/=+$/, "")}.signature`;

describe("chaves do Supabase", () => {
  it("reconhece secret keys novas e a service_role legada", () => {
    expect(isSecretKey("sb_secret_abc123")).toBe(true);
    expect(isSecretKey(jwt({ role: "service_role" }))).toBe(true);
  });

  it("publishable key e anon key legada não são secretas", () => {
    expect(isSecretKey("sb_publishable_abc123")).toBe(false);
    expect(isSecretKey(jwt({ role: "anon" }))).toBe(false);
  });

  it("recusa configuração ausente", () => {
    expect(() => validatePublicEnv(undefined, "sb_publishable_x")).toThrow(/não configurado/);
    expect(() => validatePublicEnv("https://x.supabase.co", "")).toThrow(/não configurado/);
  });

  it("recusa chave secreta na variável pública (iria para o bundle do navegador)", () => {
    expect(() => validatePublicEnv("https://x.supabase.co", "sb_secret_abc")).toThrow(/SECRETA/);
  });

  it("aceita configuração válida", () => {
    expect(validatePublicEnv("https://x.supabase.co", "sb_publishable_x")).toEqual({
      url: "https://x.supabase.co",
      publishableKey: "sb_publishable_x",
    });
  });
});
