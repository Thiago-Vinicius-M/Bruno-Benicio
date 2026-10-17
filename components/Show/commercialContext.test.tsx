import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommercialAccess } from "@/lib/sellers/commercialAccess";

const action = vi.hoisted(() => ({ prepareWhatsAppAction: vi.fn(), loadCommercialShowModelsAction: vi.fn() }));
vi.mock("@/app/actions", () => action);

const { CommercialProvider } = await import("./commercialContext");
const { Header } = await import("@/components/Header/Header");
const { Contact } = await import("@/components/Contact/Contact");

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const CODE = "k7m2q9xa";

const setSellerCookie = (code: string | null) => {
  document.cookie = code ? `bb_vendedor=${code}; path=/` : "bb_vendedor=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
};

const renderPage = () =>
  render(
    <CommercialProvider>
      <Header />
      <Contact />
    </CommercialProvider>,
  );

/** Links CONTATO na topbar e na gaveta. */
const contactNavLinks = () => screen.queryAllByRole("link", { name: "CONTATO", hidden: true });
const phones = () => screen.queryByRole("list", { name: "WhatsApp para contratar" });

beforeEach(() => {
  window.__matchingQueries.add(REDUCED_MOTION);
  action.loadCommercialShowModelsAction.mockReset();
});

afterEach(() => setSellerCookie(null));

describe("proposta comercial: contato só pelo Voltar ao WhatsApp", () => {
  it("link válido: sem CONTATO no menu, sem telefones nem 'Contrate agora!'; só o Instagram", async () => {
    setSellerCookie(CODE);
    action.loadCommercialShowModelsAction.mockResolvedValue({ status: "commercial", models: [], expiresInMs: 60_000 } satisfies CommercialAccess);
    renderPage();
    await waitFor(() => expect(action.loadCommercialShowModelsAction).toHaveBeenCalled());

    expect(contactNavLinks()).toHaveLength(0);
    expect(phones()).toBeNull();
    expect(screen.queryByText("Contrate agora!")).toBeNull();
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).toBeNull();
    // A seção CONTATO não aparece; o Instagram continua no topo.
    expect(document.querySelector("#contato")).toBeNull();
    expect(screen.getByRole("link", { name: /^Instagram @brunoebeniciobb/ }).getAttribute("href")).toBe(
      "https://www.instagram.com/brunoebeniciobb/",
    );
    // Uma consulta só ao servidor, compartilhada por menu e CONTATO.
    expect(action.loadCommercialShowModelsAction).toHaveBeenCalledTimes(1);
  });

  it("enquanto o link é conferido, os telefones não aparecem", () => {
    setSellerCookie(CODE);
    action.loadCommercialShowModelsAction.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(phones()).toBeNull();
    expect(contactNavLinks()).toHaveLength(0);
  });

  it.each([
    ["expirado", { status: "expired" }],
    ["desativado", { status: "inactive" }],
    ["com erro no servidor", { status: "error" }],
  ] as const)("link %s: menu e CONTATO normais", async (_, access) => {
    setSellerCookie(CODE);
    action.loadCommercialShowModelsAction.mockResolvedValue(access);
    renderPage();
    await waitFor(() => expect(phones()).toBeTruthy());
    expect(screen.getByText("Contrate agora!")).toBeTruthy();
    expect(contactNavLinks().length).toBeGreaterThan(0);
  });

  it("site público (sem link): tudo normal e sem consultar o servidor", () => {
    renderPage();
    expect(phones()).toBeTruthy();
    expect(screen.getByText("Contrate agora!")).toBeTruthy();
    expect(contactNavLinks().length).toBeGreaterThan(0);
    // Instagram no topo também no site público.
    expect(screen.getByRole("link", { name: /^Instagram @brunoebeniciobb/ })).toBeTruthy();
    expect(action.loadCommercialShowModelsAction).not.toHaveBeenCalled();
  });
});
