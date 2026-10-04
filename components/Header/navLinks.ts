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

/** Todos os links, na ordem da página. */
export const NAV_LINKS = [...LINKS_START, ...LINKS_END];

/** Ids das seções, na ordem da página (fora do componente: referência estável para o hook). */
export const SECTION_IDS = NAV_LINKS.map((link) => link.href.slice(1));

/** aria-current do link da seção atual (useActiveSection). */
export function currentFor(link: NavLink, active: string) {
  return link.href === `#${active}` ? ("location" as const) : undefined;
}
