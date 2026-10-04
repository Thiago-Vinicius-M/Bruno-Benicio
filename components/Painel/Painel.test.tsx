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
    for (const label of ["Agenda", "Financeiro", "Usuários", "Configurações"]) expect(nav.getByText(label)).toBeTruthy();
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
    expect(nav.queryByText("Financeiro")).toBeNull();
    expect(nav.queryByText("Usuários")).toBeNull();
    expect(nav.getByText("Agenda")).toBeTruthy();
  });

  it("funcionalidades futuras aparecem desabilitadas, sem link", () => {
    render(
      <PanelShell user={{ id: "1", name: "Bruno", role: "ADMIN" }}>
        <p />
      </PanelShell>,
    );
    const financial = screen.getByText("Financeiro").closest("[aria-disabled]");
    expect(financial?.getAttribute("aria-disabled")).toBe("true");
    expect(financial?.closest("a")).toBeNull();
    // Agenda e Usuários (ADMIN) já estão disponíveis.
    expect(screen.getByRole("link", { name: "Agenda" }).getAttribute("href")).toBe("/painel/agenda");
    expect(screen.getByRole("link", { name: "Usuários" }).getAttribute("href")).toBe("/painel/usuarios");
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
    const [home, , , , settings] = panelNavFor("ADMIN");
    expect(isActiveNavItem(home, "/painel")).toBe(true);
    expect(isActiveNavItem(home, "/painel/configuracoes/senha")).toBe(false);
    expect(isActiveNavItem(settings, "/painel/configuracoes/senha")).toBe(true);
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
