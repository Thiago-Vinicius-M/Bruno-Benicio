import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamMember } from "@/lib/agenda/usersAdmin";

const actions = vi.hoisted(() => ({
  inviteUserAction: vi.fn(),
  renameUserAction: vi.fn(),
  changeUserRoleAction: vi.fn(),
  deactivateUserAction: vi.fn(),
  reactivateUserAction: vi.fn(),
}));
vi.mock("@/app/painel/(area)/usuarios/actions", () => actions);

const { UsersView } = await import("./UsersView");
const { ToastProvider } = await import("../Toast");

const ME = "00000000-0000-4000-8000-000000000001";
const member = (overrides: Partial<TeamMember>): TeamMember => ({
  id: ME,
  name: "Bruno",
  role: "ADMIN",
  active: true,
  email: "bruno@example.com",
  invitePending: false,
  lastSignInAt: "2026-09-29T17:00:00Z",
  createdAt: "2026-09-01T12:00:00Z",
  updatedAt: "2026-09-01T12:00:00Z",
  createdBy: null,
  updatedBy: null,
  deactivatedAt: null,
  deactivatedBy: null,
  ...overrides,
});

const MEMBERS = [
  member({}),
  member({ id: "u-joao", name: "João", role: "EDITOR", email: "joao@example.com", createdBy: ME, invitePending: true, lastSignInAt: null }),
  member({
    id: "u-maria",
    name: "Maria",
    role: "EDITOR",
    email: "maria@example.com",
    active: false,
    deactivatedAt: "2026-09-20T12:00:00Z",
    deactivatedBy: ME,
  }),
];

const renderUsers = () =>
  render(
    <ToastProvider>
      <UsersView members={MEMBERS} currentUserId={ME} />
    </ToastProvider>,
  );

const row = (name: string) => screen.getByText(name).closest("li")!;

beforeEach(() => {
  for (const action of Object.values(actions)) action.mockReset();
});

describe("listagem", () => {
  it("mostra nome, e-mail, perfil, status, convite pendente e auditoria", () => {
    renderUsers();
    const joao = within(row("João"));
    expect(joao.getByText("joao@example.com")).toBeTruthy();
    expect(joao.getByText("Editor")).toBeTruthy();
    expect(joao.getByText("Ativo")).toBeTruthy();
    expect(joao.getByText("Convite pendente")).toBeTruthy();
    expect(joao.getByText(/Convidado por Bruno em 01\/09\/2026/)).toBeTruthy();

    const maria = within(row("Maria"));
    expect(maria.getByText("Inativo")).toBeTruthy();
    expect(maria.getByText("Desativado em 20/09/2026 09:00 por Bruno")).toBeTruthy();
    expect(maria.getByRole("button", { name: "Reativar Maria" })).toBeTruthy();
  });

  it("o próprio ADMIN não vê ações de rebaixar ou desativar a si mesmo", () => {
    renderUsers();
    const me = within(row("Bruno"));
    expect(me.getByText("Você")).toBeTruthy();
    expect(me.queryByRole("button", { name: /Tornar/ })).toBeNull();
    expect(me.queryByRole("button", { name: /Desativar/ })).toBeNull();
  });

  it("busca por nome/e-mail e filtros de status e perfil", () => {
    renderUsers();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar usuários" }), { target: { value: "MARIA@" } });
    expect(screen.queryByText("João")).toBeNull();
    expect(screen.getByText("Maria")).toBeTruthy();

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar usuários" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Inativos" }));
    expect(screen.queryByText("João")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "ADMIN" }));
    expect(screen.getByText("Bruno")).toBeTruthy();
    expect(screen.queryByText("Maria")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ativos" }));
    expect(screen.queryByText("Maria")).toBeNull();

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar usuários" }), { target: { value: "ninguém" } });
    expect(screen.getByText("Nenhum usuário encontrado.")).toBeTruthy();
  });
});

describe("operações", () => {
  it("alterar perfil pede confirmação mostrando Editor → Administrador", async () => {
    actions.changeUserRoleAction.mockResolvedValue({ status: "success", message: "Perfil atualizado com sucesso." });
    renderUsers();
    fireEvent.click(screen.getByRole("button", { name: "Tornar João Administrador" }));
    expect(screen.getByRole("heading", { name: "Alterar perfil?" })).toBeTruthy();
    expect(screen.getByText("Editor → Administrador")).toBeTruthy();
    expect(actions.changeUserRoleAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Perfil atualizado com sucesso.")).toBeTruthy();
    expect(actions.changeUserRoleAction).toHaveBeenCalledExactlyOnceWith("u-joao", "ADMIN");
  });

  it("desativar pede confirmação e erro do servidor vira aviso (sem alert())", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    actions.deactivateUserAction.mockResolvedValue({
      status: "error",
      message: "Não é possível remover o último administrador ativo.",
    });
    renderUsers();
    fireEvent.click(screen.getByRole("button", { name: "Desativar João" }));
    expect(screen.getByText(/perderá acesso ao painel/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    expect(await screen.findByText("Não é possível remover o último administrador ativo.")).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("não permite envio duplicado durante a operação", async () => {
    let finish!: (value: unknown) => void;
    actions.reactivateUserAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderUsers();
    fireEvent.click(screen.getByRole("button", { name: "Reativar Maria" }));
    fireEvent.click(screen.getByRole("button", { name: "Reativar" }));
    const busy = await screen.findByRole("button", { name: "Reativando…" });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(busy);
    expect(actions.reactivateUserAction).toHaveBeenCalledOnce();
    finish({ status: "success", message: "Usuário reativado." });
    expect(await screen.findByText("Usuário reativado.")).toBeTruthy();
  });

  it("convite: envia nome, e-mail e perfil; erro mantém o modal aberto", async () => {
    actions.inviteUserAction
      .mockResolvedValueOnce({ status: "error", message: "Já existe um usuário com este e-mail." })
      .mockResolvedValueOnce({ status: "success", message: "Usuário convidado com sucesso." });
    renderUsers();
    fireEvent.click(screen.getByRole("button", { name: "+ Novo usuário" }));
    expect(screen.queryByLabelText(/senha/i)).toBeNull(); // o ADMIN nunca define senha
    fireEvent.change(screen.getByLabelText("Nome *"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("E-mail *"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Perfil *"), { target: { value: "ADMIN" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar convite" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Já existe um usuário com este e-mail.");
    expect(screen.getByRole("heading", { name: "Novo usuário" })).toBeTruthy();
    expect(actions.inviteUserAction).toHaveBeenCalledWith({ name: "Ana", email: "ana@example.com", role: "ADMIN" });

    // O botão só volta a aceitar envio quando a operação anterior termina.
    fireEvent.click(await screen.findByRole("button", { name: "Enviar convite" }));
    expect(await screen.findByText("Usuário convidado com sucesso.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Novo usuário" })).toBeNull());
  });

  it("editar: só o nome (e-mail não é editável)", async () => {
    actions.renameUserAction.mockResolvedValue({ status: "success", message: "Usuário atualizado com sucesso." });
    renderUsers();
    fireEvent.click(screen.getByRole("button", { name: "Editar nome de João" }));
    expect(screen.getByText("E-mail: joao@example.com (não editável)")).toBeTruthy();
    expect(screen.getAllByRole("textbox")).toHaveLength(1); // só o nome (a busca é searchbox)
    fireEvent.change(screen.getByLabelText("Nome *"), { target: { value: "João Silva" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Usuário atualizado com sucesso.")).toBeTruthy();
    expect(actions.renameUserAction).toHaveBeenCalledWith("u-joao", "João Silva");
  });
});
