import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Video, VideoPlacement } from "@/lib/videos/types";

const actions = vi.hoisted(() => ({
  createVideoAction: vi.fn(),
  updateVideoAction: vi.fn(),
  deleteVideoAction: vi.fn(),
  setVideoPlacementAction: vi.fn(),
  setVideoActiveAction: vi.fn(),
  moveVideoAction: vi.fn(),
  updateVideoHomeLimitsAction: vi.fn(),
}));
vi.mock("@/app/painel/(area)/videos/actions", () => actions);

const { VideosView } = await import("./VideosView");
const { ToastProvider } = await import("../Toast");

let seq = 0;
const video = (title: string, placement: VideoPlacement, orientation: Video["orientation"] = "landscape", active = true) => {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    title,
    source_type: "youtube",
    source: "abcdefghijk",
    poster: null,
    orientation,
    placement,
    active,
    position: seq,
    created_by: null,
    updated_by: null,
    created_at: "2026-10-12T12:00:00Z",
    updated_at: "2026-10-12T12:00:00Z",
  } satisfies Video;
};

const MAIN = video("Principal vertical", "main", "portrait");
const S1 = video("Secundário 1", "secondary");
const S2 = video("Secundário 2", "secondary");
const OFF = video("Secundário inativo", "secondary", "landscape", false);
const G1 = video("Só galeria", "gallery", "portrait");
const VIDEOS = [MAIN, S1, S2, OFF, G1];

const renderView = (videos: Video[] = VIDEOS, limits = { desktop: 3, mobile: 2 }) =>
  render(
    <ToastProvider>
      <VideosView videos={videos} limits={limits} authors={{}} />
    </ToastProvider>,
  );

const itemOf = (title: string) => screen.getByText(title).closest("li")!;

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset().mockResolvedValue({ status: "success", message: "OK." });
});

describe("Vídeos (painel)", () => {
  it("separa principal, secundários e “só Ver mais”, e mostra onde cada um aparece em cada tela", () => {
    renderView();
    expect(itemOf("Principal vertical").textContent).toContain("Home no computador e no celular");
    expect(itemOf("Secundário 1").textContent).toContain("Home no computador e no celular");
    // Limite do celular = 2 (principal + 1): o segundo secundário vai para o “Ver mais” no celular.
    expect(itemOf("Secundário 2").textContent).toContain("Home no computador · “Ver mais” no celular");
    expect(itemOf("Secundário inativo").textContent).toContain("Fora do site");
    expect(itemOf("Secundário inativo").hasAttribute("data-inactive")).toBe(true);
    expect(itemOf("Só galeria").textContent).toContain("“Ver mais”");
  });

  it("sem principal: aviso claro e a Home começa pelos secundários", () => {
    renderView([S1, S2, G1]);
    expect(screen.getByText(/Nenhum vídeo principal/)).toBeTruthy();
  });

  it("promover outro vídeo a principal pede confirmação e só então chama a ação", async () => {
    renderView();
    fireEvent.change(screen.getByRole("combobox", { name: "Classificação de Secundário 1" }), {
      target: { value: "main" },
    });
    expect(actions.setVideoPlacementAction).not.toHaveBeenCalled();
    expect(screen.getByText(/O principal atual, “Principal vertical”, passa a ser o primeiro secundário/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tornar principal" }));
    await waitFor(() => expect(actions.setVideoPlacementAction).toHaveBeenCalledWith(S1.id, "main"));
  });

  it("sem principal atual, promover não precisa de confirmação; mudar para “Ver mais” também não", async () => {
    renderView([S1, S2, G1]);
    fireEvent.change(screen.getByRole("combobox", { name: "Classificação de Secundário 2" }), {
      target: { value: "gallery" },
    });
    await waitFor(() => expect(actions.setVideoPlacementAction).toHaveBeenCalledWith(S2.id, "gallery"));
  });

  it("vídeo inativo não pode ser escolhido como principal", () => {
    renderView();
    const select = screen.getByRole("combobox", { name: "Classificação de Secundário inativo" });
    const mainOption = [...select.querySelectorAll("option")].find((option) => option.value === "main")!;
    expect(mainOption.disabled).toBe(true);
  });

  it("ativar e desativar", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Ativar Secundário inativo" }));
    await waitFor(() => expect(actions.setVideoActiveAction).toHaveBeenCalledWith(OFF.id, true));
    // Sem envios paralelos: espera a primeira operação terminar.
    const deactivate = screen.getByRole("button", { name: "Desativar Secundário 1" }) as HTMLButtonElement;
    await waitFor(() => expect(deactivate.disabled).toBe(false));
    fireEvent.click(deactivate);
    await waitFor(() => expect(actions.setVideoActiveAction).toHaveBeenCalledWith(S1.id, false));
  });

  it("reordena dentro do grupo; o primeiro não sobe", async () => {
    renderView();
    expect((screen.getByRole("button", { name: "Subir Secundário 1" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Subir Secundário 2" }));
    await waitFor(() => expect(actions.moveVideoAction).toHaveBeenCalledWith(S2.id, "up"));
  });

  it("limites: valida no navegador (1 a 12) e envia desktop e celular independentes", async () => {
    renderView();
    const desktop = screen.getByLabelText("Computador e tablet");
    const mobile = screen.getByLabelText("Celular");
    fireEvent.change(desktop, { target: { value: "13" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar limites" }));
    expect(await screen.findByText(/números inteiros de 1 a 12/)).toBeTruthy();
    expect(actions.updateVideoHomeLimitsAction).not.toHaveBeenCalled();

    fireEvent.change(desktop, { target: { value: "6" } });
    fireEvent.change(mobile, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar limites" }));
    await waitFor(() => expect(actions.updateVideoHomeLimitsAction).toHaveBeenCalledWith({ desktop: 6, mobile: 3 }));
  });
});
