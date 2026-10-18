import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WhatsAppChannel } from "@/lib/commercialLinks/types";

const actions = vi.hoisted(() => ({
  createChannelAction: vi.fn(),
  updateChannelAction: vi.fn(),
  deactivateChannelAction: vi.fn(),
  activateChannelAction: vi.fn(),
}));
vi.mock("@/app/painel/(area)/configuracoes/actions", () => actions);

const { ChannelsPanel } = await import("./ChannelsPanel");
const { ToastProvider } = await import("../Toast");

const ADMIN = "00000000-0000-4000-8000-0000000000a1";
const SELLER = "00000000-0000-4000-8000-0000000000b1";
const OTHER = "00000000-0000-4000-8000-0000000000b2";
const OWNERS = [
  { id: ADMIN, name: "Bruno", role: "ADMIN" as const },
  { id: SELLER, name: "Ana", role: "SELLER" as const },
  { id: OTHER, name: "Caio", role: "SELLER" as const },
];

const channel = (id: string, owner: string, label: string, whatsapp: string, extra: Partial<WhatsAppChannel> = {}): WhatsAppChannel => ({
  id,
  owner_id: owner,
  label,
  whatsapp,
  active: true,
  is_primary: false,
  redirect_channel_id: null,
  created_by: ADMIN,
  updated_by: ADMIN,
  created_at: "2026-10-17T12:00:00Z",
  updated_at: "2026-10-17T12:00:00Z",
  ...extra,
});

const COMERCIAL = channel("00000000-0000-4000-8000-0000000000c1", SELLER, "Comercial", "5562999998888", { is_primary: true });
const PESSOAL = channel("00000000-0000-4000-8000-0000000000c2", SELLER, "Pessoal", "5562988887777");
const ANTIGO = channel("00000000-0000-4000-8000-0000000000c3", SELLER, "Antigo", "5562977776666", { active: false });
const ESCRITORIO = channel("00000000-0000-4000-8000-0000000000c9", ADMIN, "Escritório", "5562955554444");

const renderPanel = (channels: WhatsAppChannel[]) =>
  render(
    <ToastProvider>
      <ChannelsPanel channels={channels} owners={OWNERS} />
    </ToastProvider>,
  );

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset().mockResolvedValue({ status: "success", message: "OK." });
});

describe("WhatsApp em Configurações (ADMIN)", () => {
  it("lista só os números recebidos (os que o ADMIN cadastrou), agrupados por usuário; quem não tem número não aparece", () => {
    renderPanel([COMERCIAL, PESSOAL, ANTIGO, ESCRITORIO]);
    expect(screen.getByText(/só os números que você cadastrou/)).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "WhatsApp de Ana" })).getAllByRole("listitem")).toHaveLength(3);
    expect(within(screen.getByRole("list", { name: "WhatsApp de Bruno" })).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("Caio")).toBeNull();
  });

  it("sem números cadastrados por este ADMIN: estado vazio", () => {
    renderPanel([]);
    expect(screen.getByText("Você ainda não cadastrou nenhum WhatsApp.")).toBeTruthy();
  });

  it("desativar WhatsApp com redirecionamento para outro número ativo", async () => {
    renderPanel([COMERCIAL, PESSOAL, ANTIGO, ESCRITORIO]);
    fireEvent.click(screen.getByRole("button", { name: "Desativar Comercial de Ana" }));
    const dialog = within(screen.getByRole("dialog", { name: "Desativar WhatsApp?" }));
    const select = dialog.getByRole("combobox", { name: "Contatos dos links deste WhatsApp" }) as HTMLSelectElement;
    // Só canais ativos (e não o próprio) aparecem como destino.
    expect([...select.options].map((option) => option.textContent)).toEqual([
      "Não redirecionar (os links deixam de abrir conversa)",
      expect.stringContaining("Pessoal"),
      expect.stringContaining("Escritório"),
    ]);
    fireEvent.change(select, { target: { value: ESCRITORIO.id } });
    fireEvent.click(dialog.getByRole("button", { name: "Desativar WhatsApp" }));
    await waitFor(() => expect(actions.deactivateChannelAction).toHaveBeenCalledWith(COMERCIAL.id, ESCRITORIO.id));
  });

  it("cadastrar WhatsApp valida o número antes de enviar", async () => {
    renderPanel([ESCRITORIO]);
    fireEvent.click(screen.getByRole("button", { name: "+ Novo WhatsApp" }));
    const dialog = within(screen.getByRole("dialog", { name: "Novo WhatsApp" }));
    fireEvent.change(dialog.getByRole("combobox", { name: "Usuário *" }), { target: { value: OTHER } });
    fireEvent.change(dialog.getByRole("textbox", { name: "WhatsApp *" }), { target: { value: "62 99999-8888" } });
    fireEvent.change(dialog.getByRole("textbox", { name: "Identificação *" }), { target: { value: "Comercial" } });
    fireEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    expect((await dialog.findByRole("alert")).textContent).toMatch(/código do país/);
    expect(actions.createChannelAction).not.toHaveBeenCalled();

    fireEvent.change(dialog.getByRole("textbox", { name: "WhatsApp *" }), { target: { value: "+55 62 99999-8888" } });
    fireEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(actions.createChannelAction).toHaveBeenCalledWith({
        ownerId: OTHER,
        whatsapp: "+55 62 99999-8888",
        label: "Comercial",
        isPrimary: false,
      }),
    );
  });

  it("reativar chama a ação e avisa o resultado", async () => {
    renderPanel([ANTIGO, PESSOAL]);
    fireEvent.click(screen.getByRole("button", { name: "Reativar Antigo de Ana" }));
    await waitFor(() => expect(actions.activateChannelAction).toHaveBeenCalledWith(ANTIGO.id));
    expect(await screen.findByText("OK.")).toBeTruthy();
  });
});
