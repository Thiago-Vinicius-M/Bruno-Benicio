import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CommercialLink,
  LinkPermissions,
  WhatsAppChannel,
} from "@/lib/commercialLinks/types";
import type { PanelUser } from "@/lib/painel/access";

const actions = vi.hoisted(() => ({
  createCommercialLinkAction: vi.fn(),
  deactivateCommercialLinkAction: vi.fn(),
  createChannelAction: vi.fn(),
  updateChannelAction: vi.fn(),
  deactivateChannelAction: vi.fn(),
  activateChannelAction: vi.fn(),
  setLegacySellerActiveAction: vi.fn(),
}));
vi.mock("@/app/painel/(area)/links/actions", () => actions);

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/painel/links",
  useSearchParams: () => nav.params,
}));

const { CommercialLinksView } = await import("./CommercialLinksView");
const { ToastProvider } = await import("../Toast");

const ORIGIN = "https://brunoebenicio.com.br";
const ADMIN: PanelUser = {
  id: "00000000-0000-4000-8000-0000000000a1",
  name: "Bruno",
  role: "ADMIN",
};
const SELLER: PanelUser = {
  id: "00000000-0000-4000-8000-0000000000b1",
  name: "Ana",
  role: "SELLER",
};
const OTHER = "00000000-0000-4000-8000-0000000000b2";

const MODELS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Voz e violão",
    price: 1500,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Bruno e Benício e banda",
    price: 3000,
  },
];

const channel = (
  id: string,
  owner: string,
  label: string,
  whatsapp: string,
  extra: Partial<WhatsAppChannel> = {},
): WhatsAppChannel => ({
  id,
  owner_id: owner,
  label,
  whatsapp,
  active: true,
  is_primary: false,
  redirect_channel_id: null,
  created_by: null,
  updated_by: null,
  created_at: "2026-10-17T12:00:00Z",
  updated_at: "2026-10-17T12:00:00Z",
  ...extra,
});

const SELLER_CHANNELS = [
  channel(
    "00000000-0000-4000-8000-0000000000c1",
    SELLER.id,
    "Comercial",
    "5562999998888",
    { is_primary: true },
  ),
  channel(
    "00000000-0000-4000-8000-0000000000c2",
    SELLER.id,
    "Pessoal",
    "5562988887777",
  ),
  channel(
    "00000000-0000-4000-8000-0000000000c3",
    SELLER.id,
    "Antigo",
    "5562977776666",
    { active: false },
  ),
];

const LINK: CommercialLink = {
  id: "00000000-0000-4000-8000-0000000000d1",
  code: "0123456789abcdef",
  label: "Casamento João",
  created_by: SELLER.id,
  created_by_name: "Ana",
  created_at: "2026-10-17T15:00:00Z",
  expires_at: "2026-10-18T15:00:00Z",
  deactivated_at: null,
  status: "active",
  channel_id: SELLER_CHANNELS[0].id,
  channel_label: "Comercial",
  whatsapp: "5562999998888",
  destination: "5562911112222",
  prices: [
    {
      model_id: MODELS[0].id,
      name: "Voz e violão",
      price: 1400,
      default_price: 1500,
    },
  ],
};


function renderView({
  user = SELLER,
  permissions = {
    canCreate: true,
    canCustomizePrices: false,
  } as LinkPermissions,
  channels = SELLER_CHANNELS,
  links = [LINK],
  owners = [] as { id: string; name: string; role: "ADMIN" | "SELLER" }[],
} = {}) {
  return render(
    <ToastProvider>
      <CommercialLinksView
        user={user}
        permissions={permissions}
        links={links}
        channels={channels}
        models={MODELS}
        owners={owners}
        siteOrigin={ORIGIN}
      />
    </ToastProvider>,
  );
}

const writeText = vi.fn();

beforeEach(() => {
  // "Este mês" depende do relógio: fixa em 17/10/2026 15:00 (Brasília). Só a data é falsa.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-17T18:00:00Z"));
  nav.params = new URLSearchParams();
  nav.replace.mockReset();
  for (const fn of Object.values(actions))
    fn.mockReset().mockResolvedValue({ status: "success", message: "OK." });
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(navigator, "clipboard", {
    value: undefined,
    configurable: true,
  });
});

/** Expirados e desativados começam retraídos: abre as seções fechadas. */
const openSections = () => {
  for (const header of screen.queryAllByRole("button", { name: /^Links (expirados|desativados)/, expanded: false })) {
    fireEvent.click(header);
  }
};

const openForm = () => {
  fireEvent.click(screen.getByRole("button", { name: "Gerar link" }));
  return within(screen.getByRole("dialog", { name: "Novo link comercial" }));
};

describe("Links comerciais (vendedor)", () => {
  it("cada link numa linha: data, evento, endereço curto e validade; nada além disso", () => {
    renderView();
    const row = within(
      screen.getByRole("list", { name: "Links ativos" }),
    ).getAllByRole("listitem")[0];
    expect(row.textContent).toContain("17/10/2026");
    expect(row.textContent).toContain("Casamento João");
    expect(row.textContent).toContain(
      "brunoebenicio.com.br/p/0123456789abcdef",
    );
    expect(row.textContent).toContain("Válido até 18/10/2026");
    expect(row.textContent).not.toContain("WhatsApp");
    expect(row.textContent).not.toContain("R$");
    expect(screen.queryByRole("button", { name: /Desativar link/ })).toBeNull();
  });

  it("a seta abre o cartão completo e fecha de novo", () => {
    renderView();
    const toggle = screen.getByRole("button", {
      name: "Ver detalhes do link Casamento João",
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    const collapse = screen.getByRole("button", {
      name: "Ocultar detalhes do link Casamento João",
    });
    expect(collapse.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByRole("button", { name: "Desativar link Casamento João" }),
    ).toBeTruthy();
    fireEvent.click(collapse);
    expect(
      screen.queryByRole("button", { name: "Desativar link Casamento João" }),
    ).toBeNull();
  });

  it("linha fechada: copiar e enviar pelo WhatsApp sem abrir o cartão", async () => {
    renderView();
    fireEvent.click(
      screen.getByRole("button", { name: "Copiar link Casamento João" }),
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${ORIGIN}/p/0123456789abcdef`),
    );
    const share = screen.getByRole("link", {
      name: "Enviar link Casamento João pelo WhatsApp",
    });
    expect(share.getAttribute("href")).toBe(
      `https://wa.me/?text=${encodeURIComponent(`${ORIGIN}/p/0123456789abcdef`)}`,
    );
    expect(share.getAttribute("target")).toBe("_blank");
    expect(share.getAttribute("rel")).toContain("noopener");
  });

  it("link que não funciona (expirado): copiar e WhatsApp desabilitados", () => {
    renderView({ links: [{ ...LINK, status: "expired" }] });
    openSections();
    expect(
      (
        screen.getByRole("button", {
          name: "Copiar link Casamento João",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Enviar link Casamento João pelo WhatsApp",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.queryByRole("link", { name: /pelo WhatsApp/ })).toBeNull();
  });

  it("aberto pelo atalho do topo (?novo=1): mostra o formulário; fechar limpa o endereço", () => {
    nav.params = new URLSearchParams("novo=1");
    renderView();
    const form = within(
      screen.getByRole("dialog", { name: "Novo link comercial" }),
    );
    fireEvent.click(form.getByRole("button", { name: "Cancelar" }));
    expect(nav.replace).toHaveBeenCalledWith("/painel/links", {
      scroll: false,
    });
  });

  it("atalho do topo sem WhatsApp cadastrado: não abre o formulário, mostra o motivo", () => {
    nav.params = new URLSearchParams("novo=1");
    renderView({ channels: [] });
    expect(
      screen.queryByRole("button", { name: "Revisar proposta" }),
    ).toBeNull();
    expect(screen.getByText(/não tem um WhatsApp ativo/)).toBeTruthy();
  });

  it("detalhes: só os próprios links, com WhatsApp gravado e redirecionamento; sem preço padrão", () => {
    renderView();
    expect(screen.getByRole("heading", { name: "Meus links" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver detalhes do link Casamento João",
      }),
    );
    const card = within(
      screen.getByRole("list", { name: "Links ativos" }),
    ).getAllByRole("listitem")[0];
    expect(card.textContent).toContain("Casamento João");
    expect(card.textContent).toContain(
      "WhatsApp: Comercial · +55 (62) 99999-8888",
    );
    expect(card.textContent).toContain(
      "redirecionados para +55 (62) 91111-2222",
    );
    expect(card.textContent).toContain("1.400,00");
    expect(card.textContent).not.toContain("padrão");
    // Vendedor não vê autor, canais de todos nem links antigos.
    expect(card.textContent).not.toContain("por Ana");
    expect(
      screen.queryByRole("heading", { name: "WhatsApp dos usuários" }),
    ).toBeNull();
  });

  it("WhatsApp é obrigatório: nenhum vem pré-selecionado, nem o principal; inativos não aparecem", async () => {
    renderView();
    const form = openForm();
    const radios = form.getAllByRole("radio", {
      name: /Comercial|Pessoal|Antigo/,
    });
    expect(radios.map((radio) => (radio as HTMLInputElement).checked)).toEqual([
      false,
      false,
    ]);
    expect(form.queryByText("Antigo")).toBeNull();
    fireEvent.click(form.getByRole("button", { name: "Revisar proposta" }));
    expect((await form.findByRole("alert")).textContent).toMatch(
      /Escolha o WhatsApp/,
    );
    expect(actions.createCommercialLinkAction).not.toHaveBeenCalled();
  });

  it("sem permissão de preço: valores só para leitura e envio sem preço (padrão do banco)", async () => {
    actions.createCommercialLinkAction.mockResolvedValue({
      status: "success",
      message: "Link criado.",
      code: "fedcba9876543210",
    });
    renderView();
    const form = openForm();
    expect(form.queryByRole("textbox", { name: /Valor de/ })).toBeNull();
    fireEvent.click(form.getByRole("radio", { name: /Pessoal/ }));
    fireEvent.click(
      form.getByRole("checkbox", { name: /Bruno e Benício e banda/ }),
    );
    fireEvent.click(form.getByRole("button", { name: "Revisar proposta" }));

    const review = (await form.findByLabelText("Revisão da proposta"))
      .textContent;
    expect(review).toContain("Pessoal · +55 (62) 98888-7777");
    expect(review).toContain("Voz e violão");
    expect(review).not.toContain("Bruno e Benício e banda");
    fireEvent.click(form.getByRole("button", { name: "Gerar link" }));

    await waitFor(() =>
      expect(actions.createCommercialLinkAction).toHaveBeenCalledTimes(1),
    );
    expect(actions.createCommercialLinkAction.mock.calls[0][0]).toMatchObject({
      channelId: SELLER_CHANNELS[1].id,
      validity: "24h",
      items: [{ modelId: MODELS[0].id }],
    });
    expect(
      (
        (await form.findByRole("textbox", {
          name: "Link gerado",
        })) as HTMLInputElement
      ).value,
    ).toBe(`${ORIGIN}/p/fedcba9876543210`);
    expect(
      form
        .getByRole("link", { name: "Enviar link gerado pelo WhatsApp" })
        .getAttribute("href"),
    ).toBe(
      `https://wa.me/?text=${encodeURIComponent(`${ORIGIN}/p/fedcba9876543210`)}`,
    );
    fireEvent.click(form.getByRole("button", { name: "Copiar link gerado" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${ORIGIN}/p/fedcba9876543210`),
    );
  });

  it("com permissão: valor alterado vai na proposta; o igual ao padrão vai sem preço", async () => {
    actions.createCommercialLinkAction.mockResolvedValue({
      status: "success",
      message: "Link criado.",
      code: "fedcba9876543210",
    });
    renderView({ permissions: { canCreate: true, canCustomizePrices: true } });
    const form = openForm();
    fireEvent.click(form.getByRole("radio", { name: /Comercial/ }));
    fireEvent.change(
      form.getByRole("textbox", { name: "Valor de Voz e violão" }),
      { target: { value: "1.234,56" } },
    );
    fireEvent.click(form.getByRole("button", { name: "Revisar proposta" }));
    expect(
      (await form.findByLabelText("Revisão da proposta")).textContent,
    ).toContain("personalizado");
    fireEvent.click(form.getByRole("button", { name: "Gerar link" }));
    await waitFor(() =>
      expect(actions.createCommercialLinkAction).toHaveBeenCalledTimes(1),
    );
    expect(actions.createCommercialLinkAction.mock.calls[0][0].items).toEqual([
      { modelId: MODELS[0].id, price: 1234.56 },
      { modelId: MODELS[1].id },
    ]);
  });

  it("valor inválido, nenhum modelo ou erro do servidor: avisa no formulário", async () => {
    actions.createCommercialLinkAction.mockResolvedValue({
      status: "error",
      message: "Você não tem permissão para esta operação.",
    });
    renderView({ permissions: { canCreate: true, canCustomizePrices: true } });
    const form = openForm();
    fireEvent.click(form.getByRole("radio", { name: /Comercial/ }));
    fireEvent.change(
      form.getByRole("textbox", { name: "Valor de Voz e violão" }),
      { target: { value: "0" } },
    );
    fireEvent.click(form.getByRole("button", { name: "Revisar proposta" }));
    expect((await form.findByRole("alert")).textContent).toMatch(
      /valor válido/,
    );

    for (const model of MODELS)
      fireEvent.click(
        form.getByRole("checkbox", { name: new RegExp(model.name) }),
      );
    fireEvent.click(form.getByRole("button", { name: "Revisar proposta" }));
    expect(form.getByRole("alert").textContent).toMatch(/ao menos um modelo/);

    fireEvent.click(
      form.getByRole("checkbox", { name: /Bruno e Benício e banda/ }),
    );
    fireEvent.click(form.getByRole("button", { name: "Revisar proposta" }));
    fireEvent.click(await form.findByRole("button", { name: "Gerar link" }));
    expect((await form.findByRole("alert")).textContent).toMatch(/permissão/);
  });

  it("sem WhatsApp ativo cadastrado: não abre o formulário e explica o motivo", () => {
    renderView({ channels: [SELLER_CHANNELS[2]] });
    expect(
      (screen.getByRole("button", { name: "Gerar link" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText(/não tem um WhatsApp ativo/)).toBeTruthy();
  });

  it("desativar link pede confirmação", async () => {
    renderView();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver detalhes do link Casamento João",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Desativar link Casamento João" }),
    );
    const dialog = within(
      screen.getByRole("dialog", { name: "Desativar link?" }),
    );
    fireEvent.click(dialog.getByRole("button", { name: "Desativar link" }));
    await waitFor(() =>
      expect(actions.deactivateCommercialLinkAction).toHaveBeenCalledWith(
        LINK.id,
      ),
    );
  });
});

describe("Links comerciais (ADMIN)", () => {
  const adminChannel = channel(
    "00000000-0000-4000-8000-0000000000c9",
    ADMIN.id,
    "Escritório",
    "5562955554444",
  );
  const owners = [
    { id: ADMIN.id, name: "Bruno", role: "ADMIN" as const },
    { id: SELLER.id, name: "Ana", role: "SELLER" as const },
    { id: OTHER, name: "Caio", role: "SELLER" as const },
  ];

  it("vê autor dos links e os WhatsApp de todos agrupados por usuário; sem links permanentes antigos", () => {
    renderView({
      user: ADMIN,
      permissions: { canCreate: true, canCustomizePrices: true },
      channels: [...SELLER_CHANNELS, adminChannel],
      owners,
    });
    expect(screen.getByRole("heading", { name: "Links gerados" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver detalhes do link Casamento João",
      }),
    );
    expect(screen.getByText(/por Ana/)).toBeTruthy();
    expect(
      within(
        screen.getByRole("list", { name: "WhatsApp de Ana" }),
      ).getAllByRole("listitem"),
    ).toHaveLength(3);
    expect(screen.getByText(/Caio/).closest("li")?.textContent).toMatch(
      /ainda não consegue criar links/,
    );
    expect(screen.queryByText(/Links permanentes antigos/)).toBeNull();
  });

  it("no formulário, o ADMIN escolhe só entre os próprios WhatsApp", () => {
    renderView({
      user: ADMIN,
      permissions: { canCreate: true, canCustomizePrices: true },
      channels: [...SELLER_CHANNELS, adminChannel],
      owners,
    });
    const form = openForm();
    expect(
      form
        .getAllByRole("radio", { name: /Escritório|Comercial|Pessoal/ })
        .map((radio) => radio.closest("label")?.textContent),
    ).toEqual([expect.stringContaining("Escritório")]);
  });

  it("desativar WhatsApp com redirecionamento para outro número ativo", async () => {
    renderView({
      user: ADMIN,
      permissions: { canCreate: true, canCustomizePrices: true },
      channels: [...SELLER_CHANNELS, adminChannel],
      owners,
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Desativar Comercial de Ana" }),
    );
    const dialog = within(
      screen.getByRole("dialog", { name: "Desativar WhatsApp?" }),
    );
    const select = dialog.getByRole("combobox", {
      name: "Contatos dos links deste WhatsApp",
    }) as HTMLSelectElement;
    // Só canais ativos (e não o próprio) aparecem como destino.
    expect([...select.options].map((option) => option.textContent)).toEqual([
      "Não redirecionar (os links deixam de abrir conversa)",
      expect.stringContaining("Pessoal"),
      expect.stringContaining("Escritório"),
    ]);
    fireEvent.change(select, { target: { value: adminChannel.id } });
    fireEvent.click(dialog.getByRole("button", { name: "Desativar WhatsApp" }));
    await waitFor(() =>
      expect(actions.deactivateChannelAction).toHaveBeenCalledWith(
        SELLER_CHANNELS[0].id,
        adminChannel.id,
      ),
    );
  });

  it("cadastrar WhatsApp valida o número antes de enviar", async () => {
    renderView({
      user: ADMIN,
      permissions: { canCreate: true, canCustomizePrices: true },
      channels: [adminChannel],
      owners,
    });
    fireEvent.click(screen.getByRole("button", { name: "+ Novo WhatsApp" }));
    const dialog = within(
      screen.getByRole("dialog", { name: "Novo WhatsApp" }),
    );
    fireEvent.change(dialog.getByRole("combobox", { name: "Usuário *" }), {
      target: { value: OTHER },
    });
    fireEvent.change(dialog.getByRole("textbox", { name: "WhatsApp *" }), {
      target: { value: "62 99999-8888" },
    });
    fireEvent.change(dialog.getByRole("textbox", { name: "Identificação *" }), {
      target: { value: "Comercial" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    expect((await dialog.findByRole("alert")).textContent).toMatch(
      /código do país/,
    );
    expect(actions.createChannelAction).not.toHaveBeenCalled();

    fireEvent.change(dialog.getByRole("textbox", { name: "WhatsApp *" }), {
      target: { value: "+55 62 99999-8888" },
    });
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

  it("perfil sem permissão de criar (defesa extra): botão desabilitado", () => {
    renderView({
      user: ADMIN,
      permissions: { canCreate: false, canCustomizePrices: false },
      channels: [adminChannel],
      owners,
    });
    expect(
      (screen.getByRole("button", { name: "Gerar link" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

describe("seções e período", () => {
  const at = (
    id: string,
    created: string,
    status: CommercialLink["status"],
    label: string,
  ) => ({
    ...LINK,
    id: `00000000-0000-4000-8000-0000000000${id}`,
    code: `codigo${id}xx`,
    label,
    created_at: created,
    status,
  });
  const LINKS = [
    at("f1", "2026-10-17T15:00:00Z", "active", "Ativo de outubro"),
    at("f2", "2026-10-05T15:00:00Z", "expired", "Expirado de outubro"),
    at("f3", "2026-10-02T15:00:00Z", "revoked", "Desativado de outubro"),
    at("f4", "2026-10-10T15:00:00Z", "inactive", "Sem WhatsApp"),
    at("f5", "2026-09-20T15:00:00Z", "expired", "Expirado de setembro"),
    // 01/10 01:00 UTC = 30/09 22:00 em Brasília: é de setembro.
    at("f6", "2026-10-01T01:00:00Z", "expired", "Virada do mês"),
  ];
  const names = (section: string) =>
    within(screen.getByRole("list", { name: section }))
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");

  it("três seções, nesta ordem, com os links do mês atual (padrão)", () => {
    renderView({ links: LINKS });
    openSections();
    expect(
      screen
        .getAllByRole("button", {
          name: /^Links (ativos|expirados|desativados)/,
        })
        .map((b) => b.textContent),
    ).toEqual([
      "Links ativos (2)",
      "Links expirados (1)",
      "Links desativados (1)",
    ]);
    expect(names("Links ativos").join()).toMatch(
      /Ativo de outubro.*Sem WhatsApp/,
    );
    expect(names("Links expirados").join()).toContain("Expirado de outubro");
    expect(names("Links desativados").join()).toContain(
      "Desativado de outubro",
    );
    expect(screen.queryByText("Expirado de setembro")).toBeNull();
    expect(screen.queryByText("Virada do mês")).toBeNull();
  });

  it("padrão: ativos abertos; expirados e desativados retraídos; cada seção abre e retrai", () => {
    renderView({ links: LINKS });
    expect(screen.getByRole("button", { name: "Links ativos (2)" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Links desativados (1)" }).getAttribute("aria-expanded")).toBe("false");
    const header = screen.getByRole("button", { name: "Links expirados (1)" });
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("list", { name: "Links expirados" })).toBeNull();
    fireEvent.click(header);
    expect(screen.getByRole("list", { name: "Links expirados" })).toBeTruthy();
    fireEvent.click(header);
    expect(screen.queryByRole("list", { name: "Links expirados" })).toBeNull();
    const active = screen.getByRole("button", { name: "Links ativos (2)" });
    fireEvent.click(active);
    expect(screen.queryByRole("list", { name: "Links ativos" })).toBeNull();
  });

  it("mês passado, personalizado e período inválido", () => {
    renderView({ links: LINKS });
    openSections();
    const period = screen.getByRole("combobox", { name: "Período" });
    // Esta semana (12 a 18/10): só os criados a partir de segunda.
    fireEvent.change(period, { target: { value: "week" } });
    expect(screen.getByText("Ativo de outubro")).toBeTruthy();
    // Ativo criado antes da semana fica de fora.
    expect(screen.queryByText("Sem WhatsApp")).toBeNull();
    expect(screen.queryByText("Expirado de outubro")).toBeNull();

    fireEvent.change(period, { target: { value: "lastMonth" } });
    expect(names("Links expirados").join()).toMatch(
      /Expirado de setembro.*Virada do mês|Virada do mês.*Expirado de setembro/,
    );
    expect(screen.queryByText("Ativo de outubro")).toBeNull();

    fireEvent.change(period, { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("Data inicial"), {
      target: { value: "2026-09-15" },
    });
    fireEvent.change(screen.getByLabelText("Data final"), {
      target: { value: "2026-10-03" },
    });
    expect(
      screen.getByRole("button", { name: "Links expirados (2)" }),
    ).toBeTruthy();
    expect(names("Links desativados").join()).toContain(
      "Desativado de outubro",
    );
    expect(screen.getByText("Nenhum link ativo gerado neste período.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Data inicial"), {
      target: { value: "2026-10-20" },
    });
    expect(screen.getByRole("alert").textContent).toMatch(/período válido/);
    expect(screen.getByRole("button", { name: "Links ativos (0)" })).toBeTruthy();
  });

  it("busca pelo nome do evento: sem acento/maiúscula, em todos os períodos; limpar volta ao período", () => {
    renderView({ links: LINKS });
    const search = screen.getByRole("searchbox", { name: "Buscar pelo nome do evento" });
    fireEvent.change(search, { target: { value: "  SETEMBRO " } });
    expect(names("Links expirados").join()).toContain("Expirado de setembro");
    expect(screen.queryByText("Ativo de outubro")).toBeNull();
    expect(screen.getByText("Nenhum link ativo com esse nome.")).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Período" }) as HTMLSelectElement).disabled).toBe(true);

    fireEvent.change(search, { target: { value: "virada do MES" } });
    expect(names("Links expirados").join()).toContain("Virada do mês");

    fireEvent.change(search, { target: { value: "" } });
    expect(screen.queryByText("Expirado de setembro")).toBeNull();
    expect(screen.getByText("Ativo de outubro")).toBeTruthy();
  });
});
