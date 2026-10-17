import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FormState } from "@/lib/painel/authForms";

vi.mock("@/app/painel/actions", () => ({
  loginAction: vi.fn(),
  logoutAction: vi.fn(),
  recoverPasswordAction: vi.fn(),
  changePasswordAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/painel" }));

const { PanelShell } = await import("./PanelShell");
const { LoginForm } = await import("./LoginForm");
const { ChangePasswordForm } = await import("./ChangePasswordForm");
const { isActiveNavItem, panelNavFor } = await import("./panelNav");

describe("PanelShell", () => {
  it("ADMIN: mostra nome, papel e todos os itens do menu", () => {
    render(
      <PanelShell user={{ id: "1", name: "Bruno", role: "ADMIN" }}>
        <p>conteúdo</p>
      </PanelShell>,
    );
    expect(screen.getByText("Bruno")).toBeTruthy();
    expect(screen.getByText("Administrador")).toBeTruthy();
    const nav = within(screen.getByRole("navigation", { name: "Painel" }));
    for (const label of ["Agenda", "Vídeos", "Modelos de Show", "Links comerciais", "Configurações"]) {
      expect(nav.getByText(label)).toBeTruthy();
    }
    expect(nav.queryByText("Financeiro")).toBeNull();
    expect(nav.queryByText("Usuários")).toBeNull();
    expect(nav.queryByText("Vendedores")).toBeNull();
    expect(screen.getByRole("button", { name: "Sair" })).toBeTruthy();
    expect(screen.getByText("conteúdo")).toBeTruthy();
  });

  it("EDITOR: papel Editor e sem itens exclusivos de ADMIN", () => {
    render(
      <PanelShell user={{ id: "2", name: "Thiago", role: "EDITOR" }}>
        <p />
      </PanelShell>,
    );
    expect(screen.getByText("Editor")).toBeTruthy();
    const nav = within(screen.getByRole("navigation", { name: "Painel" }));
    expect(nav.queryByText("Modelos de Show")).toBeNull();
    expect(nav.queryByText("Links comerciais")).toBeNull();
    expect(nav.getByText("Agenda")).toBeTruthy();
  });

  it("vendedor (SELLER): só Início, Links comerciais e Configurações", () => {
    render(
      <PanelShell user={{ id: "3", name: "Ana", role: "SELLER" }}>
        <p />
      </PanelShell>,
    );
    expect(screen.getByText("Vendedor")).toBeTruthy();
    const nav = within(screen.getByRole("navigation", { name: "Painel" }));
    expect(nav.getAllByRole("link").map((link) => link.textContent)).toEqual(["Início", "Links comerciais", "Configurações"]);
  });

  it("atalho Gerar link no topo: ADMIN e vendedor; EDITOR não", () => {
    const { unmount } = render(
      <PanelShell user={{ id: "3", name: "Ana", role: "SELLER" }}>
        <p />
      </PanelShell>,
    );
    expect(screen.getByRole("link", { name: "Gerar link" }).getAttribute("href")).toBe("/painel/links?novo=1");
    unmount();
    render(
      <PanelShell user={{ id: "2", name: "Thiago", role: "EDITOR" }}>
        <p />
      </PanelShell>,
    );
    expect(screen.queryByRole("link", { name: "Gerar link" })).toBeNull();
  });

  it("seções do menu são links para as rotas do painel", () => {
    render(
      <PanelShell user={{ id: "1", name: "Bruno", role: "ADMIN" }}>
        <p />
      </PanelShell>,
    );
    expect(screen.getByRole("link", { name: "Agenda" }).getAttribute("href")).toBe("/painel/agenda");
    expect(screen.getByRole("link", { name: "Modelos de Show" }).getAttribute("href")).toBe("/painel/modelos");
    expect(screen.getByRole("link", { name: "Links comerciais" }).getAttribute("href")).toBe("/painel/links");
  });

  it("menu mobile abre e fecha (inclusive com Esc)", () => {
    render(
      <PanelShell user={{ id: "1", name: "Bruno", role: "ADMIN" }}>
        <p />
      </PanelShell>,
    );
    const toggle = screen.getByRole("button", { name: "Abrir menu" });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("navegação", () => {
  it("marca o item ativo pela seção", () => {
    const item = (label: string) => panelNavFor("ADMIN").find((nav) => nav.label === label)!;
    expect(isActiveNavItem(item("Início"), "/painel")).toBe(true);
    expect(isActiveNavItem(item("Início"), "/painel/configuracoes/senha")).toBe(false);
    expect(isActiveNavItem(item("Configurações"), "/painel/configuracoes/senha")).toBe(true);
    expect(isActiveNavItem(item("Vídeos"), "/painel/videos")).toBe(true);
  });
});

describe("formulários", () => {
  it("login mostra o erro devolvido pelo servidor, sem alert()", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const action = vi.fn(async (): Promise<FormState> => ({ status: "error", message: "E-mail ou senha incorretos." }));
    render(<LoginForm action={action} />);

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "bruno@example.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "errada" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("E-mail ou senha incorretos.");
    expect(alertSpy).not.toHaveBeenCalled();
    expect((screen.getByLabelText("E-mail") as HTMLInputElement).value).toBe("bruno@example.com");
    expect(screen.getByRole("link", { name: "Esqueci minha senha" }).getAttribute("href")).toBe(
      "/painel/recuperar-senha",
    );
  });

  it("troca de senha exibe a confirmação", async () => {
    const action = vi.fn(async (): Promise<FormState> => ({ status: "success", message: "Senha alterada com sucesso." }));
    render(<ChangePasswordForm action={action} />);

    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "nova-senha-forte" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "nova-senha-forte" } });
    fireEvent.click(screen.getByRole("button", { name: "Alterar senha" }));

    expect((await screen.findByText("Senha alterada com sucesso.")).getAttribute("role")).toBe("status");
    const sent = action.mock.calls[0] as unknown as [FormState, FormData];
    expect(sent[1].get("password")).toBe("nova-senha-forte");
    expect(sent[1].get("confirmation")).toBe("nova-senha-forte");
  });
});
