"use client";

import Image from "next/image";
import styles from "./Header.module.css";
import logoTopbar from "@/Imagens/BeB LOGO FUNDO PRETO_page-0001.png";
import { useActiveSection } from "./useActiveSection";

type NavLink = {
  label: string;
  href: string;
};

const LINKS_START: NavLink[] = [
  { label: "HOME", href: "#home" },
  { label: "SOBRE NÓS", href: "#sobre-nos" },
  { label: "VIDEOS/MÚSICAS", href: "#videos" },
];

const LINKS_END: NavLink[] = [
  { label: "AGENDA", href: "#agenda" },
  { label: "MODELOS", href: "#modelos" },
  { label: "CONTATO", href: "#contato" },
];

/** Ids das seções, na ordem da página (fora do componente: referência estável para o hook). */
const SECTION_IDS = [...LINKS_START, ...LINKS_END].map((link) => link.href.slice(1));

function NavList({ links, className, active }: { links: NavLink[]; className: string; active: string }) {
  return (
    <ul className={`${styles.list} ${className}`}>
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            className="type-nav"
            aria-current={link.href === `#${active}` ? "location" : undefined}
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function Header() {
  const active = useActiveSection(SECTION_IDS);

  return (
    <header className={styles.header}>
      <nav className={styles.nav} aria-label="Principal">
        <NavList links={LINKS_START} className={styles.listStart} active={active} />
        <Image
          src={logoTopbar}
          width={120}
          height={48}
          alt="Bruno & Benício"
          className={styles.logo}
        />
        <NavList links={LINKS_END} className={styles.listEnd} active={active} />
      </nav>
    </header>
  );
}
