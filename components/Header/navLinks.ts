/** Links da navegação principal — compartilhados pela topbar (desktop) e pela gaveta (celular). */
export type NavLink = {
  label: string;
  href: string;
};

/** Lado esquerdo do logo na topbar. */
export const LINKS_START: NavLink[] = [
  { label: "HOME", href: "#home" },
  { label: "SOBRE NÓS", href: "#sobre-nos" },
  { label: "VIDEOS/MÚSICAS", href: "#videos" },
];

/** Lado direito do logo na topbar. */
export const LINKS_END: NavLink[] = [
  { label: "NOSSO SHOW", href: "#nosso-show" },
  { label: "CONTATO", href: "#contato" },
];

/** Só com a agenda habilitada no painel: abre o lado direito (a seção vem logo após VIDEOS/MÚSICAS). */
export const AGENDA_LINK: NavLink = { label: "AGENDA", href: "#agenda" };

export type NavLayout = {
  start: NavLink[];
  end: NavLink[];
  /** Todos os links, na ordem da página. */
  all: NavLink[];
  /** Ids das seções, na ordem da página (para useActiveSection). */
  sectionIds: string[];
};

function navLayout(end: NavLink[]): NavLayout {
  const all = [...LINKS_START, ...end];
  return { start: LINKS_START, end, all, sectionIds: all.map((link) => link.href.slice(1)) };
}

const CONTACT_HREF = "#contato";
const WITHOUT_CONTACT = LINKS_END.filter((link) => link.href !== CONTACT_HREF);

// Fora do componente: referências estáveis para o hook.
const WITHOUT_AGENDA = navLayout(LINKS_END);
const WITH_AGENDA = navLayout([AGENDA_LINK, ...LINKS_END]);
// Proposta comercial: sem CONTATO (o contato é o "Voltar ao WhatsApp" de quem enviou o link).
const WITHOUT_AGENDA_COMMERCIAL = navLayout(WITHOUT_CONTACT);
const WITH_AGENDA_COMMERCIAL = navLayout([AGENDA_LINK, ...WITHOUT_CONTACT]);

export const navFor = (agenda: boolean, contact = true) =>
  contact ? (agenda ? WITH_AGENDA : WITHOUT_AGENDA) : agenda ? WITH_AGENDA_COMMERCIAL : WITHOUT_AGENDA_COMMERCIAL;

/** Navegação sem a agenda (padrão). */
export const NAV_LINKS = WITHOUT_AGENDA.all;

/** aria-current do link da seção atual (useActiveSection). */
export function currentFor(link: NavLink, active: string) {
  return link.href === `#${active}` ? ("location" as const) : undefined;
}
