import { describe, expect, it } from "vitest";
import { isPanelPath, panelRedirect, PANEL_ROUTES, safePanelPath } from "./routes";

describe("panelRedirect (proxy)", () => {
  it("cenário 1: visitante em /painel vai para o login", () => {
    expect(panelRedirect("/painel", false)).toBe(PANEL_ROUTES.login);
    expect(panelRedirect("/painel/", false)).toBe(PANEL_ROUTES.login);
  });

  it("visitante em qualquer subrota protegida vai para o login", () => {
    for (const path of ["/painel/configuracoes/senha", "/painel/acesso-negado", "/painel/qualquer/coisa"]) {
      expect(panelRedirect(path, false)).toBe(PANEL_ROUTES.login);
    }
  });

  it("cenário 2: usuário autenticado segue para o painel", () => {
    expect(panelRedirect("/painel", true)).toBeNull();
    expect(panelRedirect("/painel/configuracoes/senha", true)).toBeNull();
  });

  it("cenário 3: autenticado em login/recuperação vai para /painel", () => {
    expect(panelRedirect("/painel/login", true)).toBe(PANEL_ROUTES.home);
    expect(panelRedirect("/painel/recuperar-senha/", true)).toBe(PANEL_ROUTES.home);
  });

  it("/painel/usuarios exige sessão (o papel é checado no servidor)", () => {
    expect(panelRedirect("/painel/usuarios", false)).toBe(PANEL_ROUTES.login);
    expect(panelRedirect("/painel/usuarios", true)).toBeNull();
  });

  it("confirmação de link (convite) abre com ou sem sessão", () => {
    expect(panelRedirect("/painel/confirmar", false)).toBeNull();
    expect(panelRedirect("/painel/confirmar", true)).toBeNull();
  });

  it("login e recuperação ficam abertos para visitantes (sem loop)", () => {
    expect(panelRedirect("/painel/login", false)).toBeNull();
    expect(panelRedirect("/painel/recuperar-senha", false)).toBeNull();
  });

  it("nenhum estado gera ida e volta login ↔ painel", () => {
    for (const authenticated of [true, false]) {
      let path = "/painel";
      const visited = new Set<string>();
      for (let target = panelRedirect(path, authenticated); target; target = panelRedirect(path, authenticated)) {
        expect(visited.has(target)).toBe(false);
        visited.add(target);
        path = target;
      }
    }
  });

  it("não interfere fora do painel (site público e callback)", () => {
    for (const path of ["/", "/painelx", "/auth/confirm", "/agenda"]) {
      expect(isPanelPath(path)).toBe(false);
      expect(panelRedirect(path, false)).toBeNull();
    }
  });
});

describe("safePanelPath (destino do link do e-mail)", () => {
  it("aceita caminhos do painel, com query", () => {
    expect(safePanelPath("/painel/configuracoes/senha?recuperacao=1")).toBe("/painel/configuracoes/senha?recuperacao=1");
  });

  it("recusa open redirect e caminhos fora do painel", () => {
    for (const next of ["https://evil.com/painel", "//evil.com/painel", "/\\evil.com", "/", "/admin", "painel", null, ""]) {
      expect(safePanelPath(next)).toBe(PANEL_ROUTES.home);
    }
  });
});
