import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl, parseSiteUrl } from "./site";

afterEach(() => vi.unstubAllEnvs());

const stub = (env: Record<string, string>) => {
  for (const name of ["SITE_URL", "VERCEL_ENV", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"]) vi.stubEnv(name, "");
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
};

describe("getSiteUrl", () => {
  it("prefere SITE_URL e devolve só a origem", () => {
    stub({ SITE_URL: "https://www.site.test/qualquer/", VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "outro.test" });
    expect(getSiteUrl()?.href).toBe("https://www.site.test/");
  });

  it("em produção na Vercel usa o domínio de produção do projeto", () => {
    stub({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "site.test", VERCEL_URL: "deploy-abc.vercel.app" });
    expect(getSiteUrl()?.href).toBe("https://site.test/");
  });

  it("em preview usa a URL do deploy", () => {
    stub({ VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "site.test", VERCEL_URL: "deploy-abc.vercel.app" });
    expect(getSiteUrl()?.href).toBe("https://deploy-abc.vercel.app/");
  });

  it("fora da Vercel e sem SITE_URL não inventa endereço", () => {
    stub({});
    expect(getSiteUrl()).toBeUndefined();
  });
});

describe("parseSiteUrl", () => {
  it("recusa valores que não são URL http(s)", () => {
    expect(() => parseSiteUrl("www.site.test")).toThrow(/SITE_URL inválida/);
    expect(() => parseSiteUrl("ftp://site.test")).toThrow(/https/);
  });
});
