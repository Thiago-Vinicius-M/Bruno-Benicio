import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Show } from "@/lib/agenda/types";

const actions = vi.hoisted(() => ({
  createShowAction: vi.fn(),
  updateShowAction: vi.fn(),
  deleteShowAction: vi.fn(),
  restoreShowAction: vi.fn(),
}));
vi.mock("@/app/painel/(area)/agenda/actions", () => actions);

const { AgendaView } = await import("./AgendaView");
const { ToastProvider } = await import("../Toast");

const EDITOR = "00000000-0000-0000-0000-000000000002";
const show = (overrides: Partial<Show>): Show => ({
  id: "11111111-1111-4111-8111-111111111111",
  show_date: "2026-10-05",
  show_time: "21:00:00",
  venue_name: "Villa Mix",
  venue_instagram: "villamix",
  created_by: EDITOR,
  updated_by: EDITOR,
  deleted_by: null,
  created_at: "2026-09-29T17:03:00Z",
  updated_at: "2026-09-29T17:03:00Z",
  deleted_at: null,
  ...overrides,
});

const SHOWS = [
  show({ id: "11111111-1111-4111-8111-000000000001", show_date: "2026-09-20", venue_name: "Bar Antigo", venue_instagram: null }),
  show({ id: "11111111-1111-4111-8111-000000000002" }),
  show({ id: "11111111-1111-4111-8111-000000000003", show_date: "2026-11-12", show_time: "22:30:00", venue_name: "Casa Y", venue_instagram: "casay" }),
];
const NOW = { date: "2026-09-29", time: "15:00" };

function renderAgenda(shows: Show[] = SHOWS, filter: "todos" | "excluidos" = "todos") {
  return render(
    <ToastProvider>
      <AgendaView shows={shows} filter={filter} authors={{ [EDITOR]: "Thiago" }} now={NOW} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  for (const action of Object.values(actions)) action.mockReset();
});

describe("lista", () => {
  it("mostra data, horário, local e Instagram clicável em nova aba, agrupados por mês", () => {
    renderAgenda();
    expect(screen.getByRole("heading", { name: "Outubro 2026" })).toBeTruthy();
    const row = screen.getByText("Villa Mix").closest("li")!;
    expect(within(row).getByText("05")).toBeTruthy();
    expect(within(row).getByText("out")).toBeTruthy();
    expect(within(row).getByText("21:00")).toBeTruthy();
    const link = within(row).getByRole("link", { name: "@villamix" });
    expect(link.getAttribute("href")).toBe("https://www.instagram.com/villamix/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("marca shows já realizados", () => {
    renderAgenda();
    expect(within(screen.getByText("Bar Antigo").closest("li")!).getByText("Realizado")).toBeTruthy();
    expect(within(screen.getByText("Villa Mix").closest("li")!).queryByText("Realizado")).toBeNull();
  });

  it("filtra por mês e por busca (sem acento e sem @)", () => {
    renderAgenda();
    fireEvent.click(screen.getByRole("button", { name: "Novembro 2026" }));
    expect(screen.queryByText("Villa Mix")).toBeNull();
    expect(screen.getByText("Casa Y")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Todos os meses" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar shows" }), { target: { value: "@VILLA" } });
    expect(screen.getByText("Villa Mix")).toBeTruthy();
    expect(screen.queryByText("Casa Y")).toBeNull();

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar shows" }), { target: { value: "inexistente" } });
    expect(screen.getByText("Nenhum show encontrado para essa busca.")).toBeTruthy();
  });

  it("estado vazio oferece adicionar show", () => {
    renderAgenda([]);
    expect(screen.getByText("Nenhum show encontrado.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "+ Adicionar show" }));
    expect(screen.getByRole("heading", { name: "Novo show" })).toBeTruthy();
  });
});

describe("operações", () => {
  it("criar: valida no navegador antes de chamar o servidor", async () => {
    renderAgenda();
    fireEvent.click(screen.getByRole("button", { name: "+ Novo show" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Data do show inválida.");
    expect(actions.createShowAction).not.toHaveBeenCalled();
  });

  it("criar: envia os campos, fecha o modal e mostra o aviso (sem alert())", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    actions.createShowAction.mockResolvedValue({ status: "success", message: "Show criado com sucesso." });
    renderAgenda();
    fireEvent.click(screen.getByRole("button", { name: "+ Novo show" }));
    fireEvent.change(screen.getByLabelText("Data *"), { target: { value: "2026-12-01" } });
    fireEvent.change(screen.getByLabelText("Horário *"), { target: { value: "20:00" } });
    fireEvent.change(screen.getByLabelText("Nome do local *"), { target: { value: "Casa Z" } });
    fireEvent.change(screen.getByLabelText("Instagram da casa"), { target: { value: "@casaz" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Show criado com sucesso.")).toBeTruthy();
    expect(actions.createShowAction).toHaveBeenCalledWith({
      showDate: "2026-12-01",
      showTime: "20:00",
      venueName: "Casa Z",
      venueInstagram: "@casaz",
    });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Novo show" })).toBeNull());
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("editar: formulário vem preenchido, mostra a auditoria e mantém o modal com o erro do servidor", async () => {
    actions.updateShowAction.mockResolvedValue({ status: "error", message: "Não foi possível salvar o show. Tente novamente." });
    renderAgenda();
    fireEvent.click(screen.getByRole("button", { name: "Editar show de 05/10/2026 em Villa Mix" }));
    expect((screen.getByLabelText("Data *") as HTMLInputElement).value).toBe("2026-10-05");
    expect((screen.getByLabelText("Horário *") as HTMLInputElement).value).toBe("21:00");
    expect((screen.getByLabelText("Instagram da casa") as HTMLInputElement).value).toBe("@villamix");
    expect(screen.getByText(/Criado por Thiago em 29\/09\/2026 14:03/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Horário *"), { target: { value: "22:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Não foi possível salvar o show. Tente novamente.");
    expect(actions.updateShowAction).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-000000000002",
      expect.objectContaining({ showTime: "22:00" }),
    );
    expect(screen.getByRole("heading", { name: "Editar show" })).toBeTruthy();
  });

  it("excluir: pede confirmação antes; só exclui ao confirmar", async () => {
    actions.deleteShowAction.mockResolvedValue({ status: "success", message: "Show excluído com sucesso." });
    renderAgenda();
    fireEvent.click(screen.getByRole("button", { name: "Excluir show de 05/10/2026 em Villa Mix" }));
    expect(actions.deleteShowAction).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Excluir show?" })).toBeTruthy();
    expect(screen.getByText(/permanecerá no histórico/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(actions.deleteShowAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Excluir show de 05/10/2026 em Villa Mix" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir show" }));
    expect(await screen.findByText("Show excluído com sucesso.")).toBeTruthy();
    expect(actions.deleteShowAction).toHaveBeenCalledExactlyOnceWith("11111111-1111-4111-8111-000000000002");
  });

  it("não permite envios duplicados enquanto a operação está em andamento", async () => {
    let finish!: (value: unknown) => void;
    actions.deleteShowAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderAgenda();
    fireEvent.click(screen.getByRole("button", { name: "Excluir show de 05/10/2026 em Villa Mix" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir show" }));

    const busy = await screen.findByRole("button", { name: "Excluindo…" });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(busy);
    expect(actions.deleteShowAction).toHaveBeenCalledOnce();
    finish({ status: "success", message: "Show excluído com sucesso." });
    expect(await screen.findByText("Show excluído com sucesso.")).toBeTruthy();
  });

  it("excluídos: mostra quem excluiu e permite restaurar", async () => {
    actions.restoreShowAction.mockResolvedValue({ status: "success", message: "Show restaurado com sucesso." });
    renderAgenda([show({ deleted_at: "2026-09-29T18:00:00Z", deleted_by: EDITOR })], "excluidos");
    expect(screen.getByText("Excluído em 29/09/2026 15:00 por Thiago")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Editar/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Restaurar show de 05/10/2026 em Villa Mix" }));
    expect(await screen.findByText("Show restaurado com sucesso.")).toBeTruthy();
    expect(actions.restoreShowAction).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
  });

  it("falha de rede vira aviso de erro", async () => {
    actions.restoreShowAction.mockRejectedValue(new TypeError("Failed to fetch"));
    renderAgenda([show({ deleted_at: "2026-09-29T18:00:00Z", deleted_by: EDITOR })], "excluidos");
    fireEvent.click(screen.getByRole("button", { name: "Restaurar show de 05/10/2026 em Villa Mix" }));
    expect(await screen.findByText(/Verifique a conexão/)).toBeTruthy();
  });
});
