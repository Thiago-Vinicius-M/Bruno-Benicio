import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Seller } from "@/lib/sellers/types";

const actions = vi.hoisted(() => ({
  createSellerAction: vi.fn(),
  updateSellerAction: vi.fn(),
  setSellerActiveAction: vi.fn(),
}));
vi.mock("@/app/painel/(area)/vendedores/actions", () => actions);

const { SellersView } = await import("./SellersView");
const { ToastProvider } = await import("../Toast");

const seller = (id: string, name: string, code: string, active = true, whatsapp = "5562999998888"): Seller => ({
  id,
  name,
  whatsapp,
  code,
  active,
  created_by: null,
  updated_by: null,
  created_at: "2026-10-12T12:00:00Z",
  updated_at: "2026-10-12T12:00:00Z",
});

const SELLERS = [
  seller("00000000-0000-4000-8000-000000000001", "Ana", "a1b2c3d4e5f6"),
  seller("00000000-0000-4000-8000-000000000002", "Carlos", "0f9e8d7c6b5a", false, "5511987654321"),
];
const ORIGIN = "https://brunoebenicio.com.br";

const renderView = (sellers = SELLERS) =>
  render(
    <ToastProvider>
      <SellersView sellers={sellers} siteOrigin={ORIGIN} />
    </ToastProvider>,
  );

const writeText = vi.fn();

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset().mockResolvedValue({ status: "success", message: "OK." });
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

afterEach(() => {
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
});

describe("Vendedores (painel)", () => {
  it("lista nome, WhatsApp formatado, link exclusivo e status do link", () => {
    renderView();
    const [ana, carlos] = within(screen.getByRole("list", { name: "Vendedores" })).getAllByRole("listitem");
    expect(ana.textContent).toContain("Link ativo");
    expect(ana.textContent).toContain("+55 (62) 99999-8888");
    expect((screen.getByLabelText("Link de Ana") as HTMLInputElement).value).toBe(`${ORIGIN}/r/a1b2c3d4e5f6`);
    expect(carlos.textContent).toContain("Link desativado");
    expect(carlos.hasAttribute("data-inactive")).toBe(true);
    // O telefone nunca aparece no link.
    expect((screen.getByLabelText("Link de Carlos") as HTMLInputElement).value).not.toContain("987654321");
  });

  it("copiar o link usa a área de transferência e confirma com aviso", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Copiar link de Ana" }));
    expect(await screen.findByText("Link de Ana copiado.")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(`${ORIGIN}/r/a1b2c3d4e5f6`);
  });

  it("sem acesso à área de transferência: aviso para copiar à mão", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Copiar link de Ana" }));
    expect(await screen.findByText(/Selecione o link e copie manualmente/)).toBeTruthy();
  });

  it("link de vendedor desativado não pode ser copiado", () => {
    renderView();
    expect((screen.getByRole("button", { name: "Copiar link de Carlos" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("cadastro valida e normaliza o WhatsApp antes de enviar", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "+ Novo vendedor" }));
    fireEvent.change(screen.getByLabelText("Nome *"), { target: { value: "Bia" } });
    fireEvent.change(screen.getByLabelText("WhatsApp *"), { target: { value: "(62) 98888-7777" } });
    expect(screen.getByText(/Inclua o código do país/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/código do país/);
    expect(actions.createSellerAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("WhatsApp *"), { target: { value: "+55 (62) 98888-7777" } });
    expect(screen.getByText("A conversa abre em +55 (62) 98888-7777.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(actions.createSellerAction).toHaveBeenCalledWith({ name: "Bia", whatsapp: "+55 (62) 98888-7777" }),
    );
  });

  it("edição avisa que o link continua o mesmo", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Editar Ana" }));
    expect((screen.getByLabelText("WhatsApp *") as HTMLInputElement).value).toBe("+55 (62) 99999-8888");
    expect(screen.getByText(/link deste vendedor continua o mesmo/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("WhatsApp *"), { target: { value: "+55 11 98765-4321" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(actions.updateSellerAction).toHaveBeenCalledWith(SELLERS[0].id, { name: "Ana", whatsapp: "+55 11 98765-4321" }),
    );
  });

  it("desativar pede confirmação; ativar é direto", async () => {
    actions.setSellerActiveAction.mockResolvedValue({ status: "success", message: "Vendedor desativado: o link deixou de funcionar." });
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Desativar Ana" }));
    expect(actions.setSellerActiveAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Desativar vendedor" }));
    expect(await screen.findByText("Vendedor desativado: o link deixou de funcionar.")).toBeTruthy();
    expect(actions.setSellerActiveAction).toHaveBeenCalledWith(SELLERS[0].id, false);

    // Sem envios paralelos: o próximo clique só vale quando a operação anterior termina.
    const activate = screen.getByRole("button", { name: "Ativar Carlos" }) as HTMLButtonElement;
    await waitFor(() => expect(activate.disabled).toBe(false));
    fireEvent.click(activate);
    await waitFor(() => expect(actions.setSellerActiveAction).toHaveBeenCalledWith(SELLERS[1].id, true));
  });

  it("lista vazia convida a cadastrar", () => {
    renderView([]);
    expect(screen.getByText(/Nenhum vendedor cadastrado/)).toBeTruthy();
  });
});
