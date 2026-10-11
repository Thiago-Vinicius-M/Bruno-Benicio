import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollTrigger } from "@/animations/gsap";
import type { CommercialAccess } from "@/lib/sellers/commercialAccess";
import type { WhatsAppReturnResult } from "@/lib/sellers/whatsappReturn";
import { formatPrice } from "@/lib/showModels/price";
import type { CommercialShowModel, PublicShowModel, ShowModelsState } from "@/lib/showModels/types";

const action = vi.hoisted(() => ({ prepareWhatsAppAction: vi.fn(), loadCommercialShowModelsAction: vi.fn() }));
vi.mock("@/app/actions", () => action);

const { Show } = await import("./Show");

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const MOBILE = "(max-width: 767px)";
const CODE = "a1b2c3d4e5f6";

const model = (id: number, name: string, price: number, description: string | null = null): CommercialShowModel => ({
  id: `00000000-0000-4000-8000-00000000000${id}`,
  name,
  duration: "2h30 de show",
  description,
  price,
});

const COMMERCIAL = [
  model(1, "Voz e violão", 1500),
  model(2, "Voz, violão e bateria", 1800),
  model(3, "Voz, violão, sanfona e bateria", 2200),
  model(4, "Bruno e Benício e banda", 3000),
];
/** O que a página estática recebe: os mesmos modelos, sem preço. */
const PUBLIC: PublicShowModel[] = COMMERCIAL.map(({ id, name, duration, description }) => ({
  id,
  name,
  duration,
  description,
}));
const READY: ShowModelsState = { status: "ready", models: PUBLIC };
const WA_URL = "https://wa.me/5562999998888?text=Ol%C3%A1";

const setSellerCookie = (code: string | null) => {
  document.cookie = code ? `bb_vendedor=${code}; path=/` : "bb_vendedor=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
};

const rows = () =>
  within(screen.getByRole("list", { name: "Formatos de show" }))
    .getAllByRole("listitem")
    .map((li) => li.textContent?.replace(/\s/g, " "));

const PRICE_TEXT = /R\$/;

beforeEach(() => {
  window.__matchingQueries.add(REDUCED_MOTION);
  action.prepareWhatsAppAction.mockReset();
  action.loadCommercialShowModelsAction.mockReset();
  action.loadCommercialShowModelsAction.mockResolvedValue({
    status: "commercial",
    models: COMMERCIAL,
  } satisfies CommercialAccess);
});

afterEach(() => setSellerCookie(null));

describe("versão pública (sem link de vendedor)", () => {
  it("formatos com duração, na ordem recebida, sem nenhum valor", () => {
    render(<Show models={READY} />);
    expect(rows()).toEqual([
      "Voz e violão2h30 de show",
      "Voz, violão e bateria2h30 de show",
      "Voz, violão, sanfona e bateria2h30 de show",
      "Bruno e Benício e banda2h30 de show",
    ]);
    expect(document.body.textContent).not.toMatch(PRICE_TEXT);
  });

  it("não pede a versão comercial ao servidor nem mostra escolha ou WhatsApp", () => {
    render(<Show models={READY} />);
    expect(action.loadCommercialShowModelsAction).not.toHaveBeenCalled();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Voltar ao WhatsApp/ })).toBeNull();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByLabelText("Data")).toBeNull();
  });

  it("descrição opcional aparece abaixo da duração", () => {
    render(<Show models={{ status: "ready", models: [{ ...PUBLIC[0], description: "Ideal para eventos menores" }] }} />);
    expect(screen.getByText("Ideal para eventos menores")).toBeTruthy();
  });

  it("falha ao carregar ou nenhum formato ativo: aviso para usar os contatos", () => {
    const { unmount } = render(<Show models={{ status: "error" }} />);
    expect(screen.queryByRole("list", { name: "Formatos de show" })).toBeNull();
    expect(screen.getByText(/Não foi possível carregar os formatos/)).toBeTruthy();
    unmount();

    render(<Show models={{ status: "ready", models: [] }} />);
    expect(screen.getByText(/Consulte os formatos de show disponíveis/)).toBeTruthy();
  });

  it("repertório e estrutura continuam na seção", () => {
    render(<Show models={READY} />);
    expect(screen.getByText("Sertanejo, modão, MPB, pagode, pop rock e forró.")).toBeTruthy();
    expect(screen.getByText("Estrutura de som e iluminação")).toBeTruthy();
  });
});

describe("versão comercial (link de vendedor)", () => {
  beforeEach(() => setSellerCookie(CODE));

  it("valores só aparecem depois da resposta do servidor; cada formato vira uma opção", async () => {
    render(<Show models={READY} />);
    // Antes da verificação no servidor: versão pública.
    expect(document.body.textContent).not.toMatch(PRICE_TEXT);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);

    expect(await screen.findAllByRole("radio")).toHaveLength(4);
    expect(action.loadCommercialShowModelsAction).toHaveBeenCalledTimes(1);
    expect(rows()[1]).toBe(`Voz, violão e bateria2h30 de show${formatPrice(1800)}`.replace(/\s/g, " "));
    const button = screen.getByRole("button", { name: "Voltar ao WhatsApp" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/Escolha um formato acima/)).toBeTruthy();
    // Data/horário só depois da escolha.
    expect(screen.queryByLabelText("Data")).toBeNull();
    expect(action.prepareWhatsAppAction).not.toHaveBeenCalled();
  });

  it("escolher destaca o formato, mostra data/horário opcionais e habilita o link do WhatsApp", async () => {
    action.prepareWhatsAppAction.mockResolvedValue({ status: "ready", url: WA_URL } satisfies WhatsAppReturnResult);
    render(<Show models={READY} />);

    const radio = (await screen.findByRole("radio", { name: /Voz, violão e bateria/ })) as HTMLInputElement;
    fireEvent.click(radio);

    expect(radio.checked).toBe(true);
    expect(radio.closest("li")?.hasAttribute("data-selected")).toBe(true);
    expect(screen.getByRole("radio", { name: /^Voz e violão / }).closest("li")?.hasAttribute("data-selected")).toBe(false);
    expect((screen.getByLabelText("Data") as HTMLInputElement).type).toBe("date");
    expect((screen.getByLabelText("Horário") as HTMLInputElement).type).toBe("time");

    const link = await screen.findByRole("link", { name: /Voltar ao WhatsApp/ });
    expect(action.prepareWhatsAppAction).toHaveBeenCalledWith({
      modelId: COMMERCIAL[1].id,
      name: COMMERCIAL[1].name,
      price: 1800,
      date: null,
      time: null,
    });
    expect(link.getAttribute("href")).toBe(WA_URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(screen.getByText(/Formato escolhido: Voz, violão e bateria/).textContent).toContain(formatPrice(1800));
  });

  it("data e horário são independentes e vão para a mensagem; trocar de formato mantém os dois", async () => {
    action.prepareWhatsAppAction.mockResolvedValue({ status: "ready", url: WA_URL });
    render(<Show models={READY} />);
    fireEvent.click(await screen.findByRole("radio", { name: /^Voz e violão / }));

    fireEvent.change(screen.getByLabelText("Horário"), { target: { value: "21:30" } });
    await waitFor(() =>
      expect(action.prepareWhatsAppAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ modelId: COMMERCIAL[0].id, date: null, time: "21:30" }),
      ),
    );

    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-12-20" } });
    await waitFor(() =>
      expect(action.prepareWhatsAppAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ date: "2026-12-20", time: "21:30" }),
      ),
    );

    fireEvent.click(screen.getByRole("radio", { name: /Bruno e Benício e banda/ }));
    await waitFor(() =>
      expect(action.prepareWhatsAppAction).toHaveBeenLastCalledWith({
        modelId: COMMERCIAL[3].id,
        name: "Bruno e Benício e banda",
        price: 3000,
        date: "2026-12-20",
        time: "21:30",
      }),
    );
  });

  it("enquanto prepara, o botão fica desabilitado (sem URL incompleta)", async () => {
    let resolve!: (value: WhatsAppReturnResult) => void;
    action.prepareWhatsAppAction.mockReturnValue(new Promise((done) => (resolve = done)));
    render(<Show models={READY} />);
    fireEvent.click(await screen.findByRole("radio", { name: /^Voz e violão / }));

    expect((screen.getByRole("button", { name: "Voltar ao WhatsApp" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Preparando a mensagem…")).toBeTruthy();
    await waitFor(() => expect(action.prepareWhatsAppAction).toHaveBeenCalled());
    await act(async () => resolve({ status: "ready", url: WA_URL }));
    expect(screen.getByRole("link", { name: /Voltar ao WhatsApp/ })).toBeTruthy();
  });

  it("trocar rápido de formato: vale só a resposta da última escolha", async () => {
    const pending: Array<(value: WhatsAppReturnResult) => void> = [];
    action.prepareWhatsAppAction.mockImplementation(() => new Promise((done) => pending.push(done)));
    render(<Show models={READY} />);
    fireEvent.click(await screen.findByRole("radio", { name: /^Voz e violão / }));
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.click(screen.getByRole("radio", { name: /Bruno e Benício e banda/ }));
    await waitFor(() => expect(pending).toHaveLength(2));

    await act(async () => pending[1]({ status: "ready", url: `${WA_URL}-banda` }));
    await act(async () => pending[0]({ status: "ready", url: `${WA_URL}-violao` }));
    expect(screen.getByRole("link", { name: /Voltar ao WhatsApp/ }).getAttribute("href")).toBe(`${WA_URL}-banda`);
  });

  it("vendedor desativado / formato alterado no meio do caminho: mensagem e nenhum link", async () => {
    action.prepareWhatsAppAction.mockResolvedValue({
      status: "error",
      reason: "seller-inactive",
      message: "Este link de atendimento não está mais ativo. Fale com a gente pelos contatos abaixo.",
    } satisfies WhatsAppReturnResult);
    render(<Show models={READY} />);
    fireEvent.click(await screen.findByRole("radio", { name: /^Voz e violão / }));

    expect(await screen.findByText(/não está mais ativo/)).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect((screen.getByRole("button", { name: "Voltar ao WhatsApp" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("falha de rede: oferece tentar de novo", async () => {
    action.prepareWhatsAppAction.mockRejectedValueOnce(new Error("offline"));
    action.prepareWhatsAppAction.mockResolvedValueOnce({ status: "ready", url: WA_URL });
    render(<Show models={READY} />);
    fireEvent.click(await screen.findByRole("radio", { name: /^Voz e violão / }));

    fireEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("link", { name: /Voltar ao WhatsApp/ })).toBeTruthy();
    expect(action.prepareWhatsAppAction).toHaveBeenCalledTimes(2);
  });

  it("no celular a escolha e o link funcionam igual (mesmo link oficial wa.me)", async () => {
    window.__matchingQueries = new Set([MOBILE, REDUCED_MOTION]);
    action.prepareWhatsAppAction.mockResolvedValue({ status: "ready", url: WA_URL });
    render(<Show models={READY} />);
    fireEvent.click(await screen.findByRole("radio", { name: /Bruno e Benício e banda/ }));
    expect((await screen.findByRole("link", { name: /Voltar ao WhatsApp/ })).getAttribute("href")).toBe(WA_URL);
  });

  it("teclado: as opções são rádios nativos (setas e espaço) com o mesmo nome de grupo", async () => {
    render(<Show models={READY} />);
    const radios = await screen.findAllByRole("radio");
    expect(new Set(radios.map((radio) => (radio as HTMLInputElement).name))).toEqual(new Set(["nosso-show-formato"]));
  });
});

describe("versão comercial recusada pelo servidor", () => {
  beforeEach(() => setSellerCookie(CODE));

  it("link desativado: aviso, nenhum valor, nenhuma escolha", async () => {
    action.loadCommercialShowModelsAction.mockResolvedValue({ status: "inactive" } satisfies CommercialAccess);
    render(<Show models={READY} />);
    expect(await screen.findByText(/link de atendimento não está mais ativo/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(PRICE_TEXT);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(rows()).toHaveLength(4);
  });

  it("banco fora do ar (ou falha de rede): aviso e versão pública", async () => {
    action.loadCommercialShowModelsAction.mockRejectedValue(new Error("offline"));
    render(<Show models={READY} />);
    expect(await screen.findByText(/Não foi possível carregar os valores/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(PRICE_TEXT);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });
});

describe("animação", () => {
  it("cria a entrada (desktop e celular) e a remove ao desmontar, também com a versão comercial", async () => {
    window.__matchingQueries = new Set([window.__matchingQueries.has(MOBILE) ? MOBILE : "(min-width: 1024px)"]);
    const { unmount } = render(<Show models={READY} />);
    expect(ScrollTrigger.getAll()).toHaveLength(1);
    unmount();

    setSellerCookie(CODE);
    window.__matchingQueries = new Set([MOBILE]);
    const mobile = render(<Show models={READY} />);
    await screen.findAllByRole("radio");
    // Mesmos cards (mesmos ids): a entrada não é duplicada quando os valores chegam.
    expect(ScrollTrigger.getAll()).toHaveLength(1);
    mobile.unmount();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });
});
