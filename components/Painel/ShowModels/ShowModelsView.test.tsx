import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShowModel } from "@/lib/showModels/types";

const actions = vi.hoisted(() => ({
  createShowModelAction: vi.fn(),
  updateShowModelAction: vi.fn(),
  setShowModelActiveAction: vi.fn(),
  moveShowModelAction: vi.fn(),
}));
vi.mock("@/app/painel/(area)/modelos/actions", () => actions);

const { ShowModelsView } = await import("./ShowModelsView");
const { ToastProvider } = await import("../Toast");

const model = (id: string, name: string, price: number, active = true): ShowModel => ({
  id,
  name,
  duration: "2h30 de show",
  description: null,
  price,
  corporate_price: price + 500,
  active,
  position: Number(id.slice(-1)),
  created_by: null,
  updated_by: null,
  created_at: "2026-10-12T12:00:00Z",
  updated_at: "2026-10-12T12:00:00Z",
});

const MODELS = [
  model("00000000-0000-4000-8000-000000000001", "Voz e violão", 1500),
  model("00000000-0000-4000-8000-000000000002", "Voz, violão e bateria", 1800, false),
  model("00000000-0000-4000-8000-000000000003", "Bruno e Benício e banda", 3000),
];

const renderView = (models = MODELS) =>
  render(
    <ToastProvider>
      <ShowModelsView models={models} authors={{}} />
    </ToastProvider>,
  );

const plain = (text: string | null | undefined) => text?.replace(/\s/g, " ");

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset().mockResolvedValue({ status: "success", message: "OK." });
});

describe("Modelos de Show (painel)", () => {
  it("lista na ordem com nome, valor e status ativo/inativo", () => {
    renderView();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => plain(item.querySelector("p")?.textContent))).toEqual([
      "Voz e violãoAtivo",
      "Voz, violão e bateriaInativo",
      "Bruno e Benício e bandaAtivo",
    ]);
    expect(plain(items[0].textContent)).toContain("R$ 1.500,00");
    expect(items[1].hasAttribute("data-inactive")).toBe(true);
    expect(screen.getByText("2 de 3 modelos ativos no site.")).toBeTruthy();
  });

  it("ordenação: sobe/desce chama a ação; o primeiro não sobe e o último não desce", async () => {
    renderView();
    expect((screen.getByRole("button", { name: "Subir Voz e violão" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Descer Bruno e Benício e banda" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Subir Bruno e Benício e banda" }));
    await waitFor(() => expect(actions.moveShowModelAction).toHaveBeenCalledWith(MODELS[2].id, "up"));
  });

  it("ativar e desativar com aviso de sucesso", async () => {
    actions.setShowModelActiveAction.mockResolvedValue({ status: "success", message: "Modelo ativado: já aparece no site." });
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Ativar Voz, violão e bateria" }));
    expect(await screen.findByText("Modelo ativado: já aparece no site.")).toBeTruthy();
    expect(actions.setShowModelActiveAction).toHaveBeenCalledWith(MODELS[1].id, true);

    // Sem envios paralelos: o próximo clique só vale quando a operação anterior termina.
    const deactivate = screen.getByRole("button", { name: "Desativar Voz e violão" }) as HTMLButtonElement;
    await waitFor(() => expect(deactivate.disabled).toBe(false));
    fireEvent.click(deactivate);
    await waitFor(() => expect(actions.setShowModelActiveAction).toHaveBeenCalledWith(MODELS[0].id, false));
  });

  it("cadastro valida no navegador antes de enviar (valor inválido não chega ao servidor)", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "+ Novo modelo" }));
    fireEvent.change(screen.getByLabelText("Nome do modelo *"), { target: { value: "Acústico" } });
    fireEvent.change(screen.getByLabelText("Duração *"), { target: { value: "1h30 de show" } });
    fireEvent.change(screen.getByLabelText("Valor particular (R$) *"), { target: { value: "abc" } });
    expect(screen.getByText(/Valor inválido/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/valor válido/);
    expect(actions.createShowModelAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Valor particular (R$) *"), { target: { value: "1.250,00" } });
    expect(plain(screen.getByText(/Eventos particulares:/).textContent)).toContain("R$ 1.250,00");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/corporativo/);
    expect(actions.createShowModelAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Valor corporativo (R$) *"), { target: { value: "1.750,00" } });
    expect(plain(screen.getByText(/Eventos corporativos:/).textContent)).toContain("R$ 1.750,00");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(actions.createShowModelAction).toHaveBeenCalledWith({
        name: "Acústico",
        duration: "1h30 de show",
        description: "",
        price: "1.250,00",
        corporatePrice: "1.750,00",
        active: true,
      }),
    );
  });

  it("edição abre com os dados atuais e mostra o erro devolvido pelo servidor", async () => {
    actions.updateShowModelAction.mockResolvedValue({ status: "error", message: "Já existe um modelo com este nome." });
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Editar Voz e violão" }));
    expect((screen.getByLabelText("Nome do modelo *") as HTMLInputElement).value).toBe("Voz e violão");
    expect((screen.getByLabelText("Valor particular (R$) *") as HTMLInputElement).value).toBe("1.500,00");
    expect(screen.queryByText("Ativo", { selector: "strong" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Nome do modelo *"), { target: { value: "Bruno e Benício e banda" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Já existe um modelo com este nome.");
    expect(actions.updateShowModelAction).toHaveBeenCalledWith(MODELS[0].id, expect.objectContaining({ price: "1.500,00" }));
  });

  it("sem exclusão: nenhum botão de excluir", () => {
    renderView();
    expect(screen.queryByRole("button", { name: /Excluir/ })).toBeNull();
  });

  it("lista vazia explica o efeito no site", () => {
    renderView([]);
    expect(screen.getByText(/Nenhum modelo cadastrado/)).toBeTruthy();
  });
});
