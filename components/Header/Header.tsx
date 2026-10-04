"use client";

import Image from "next/image";
import styles from "./Header.module.css";
import logoTopbar from "@/Imagens/BeB LOGO FUNDO PRETO_page-0001.png";
import { MobileMenu } from "./MobileMenu";
import { currentFor, LINKS_END, LINKS_START, NAV_LINKS, SECTION_IDS, type NavLink } from "./navLinks";
import { useActiveSection } from "./useActiveSection";

function NavList({ links, active, className }: { links: NavLink[]; active: string; className?: string }) {
  return (
    <ul className={className ? `${styles.list} ${className}` : styles.list}>
      {links.map((link) => (
        <li key={link.href}>
          <a href={link.href} className="type-nav" aria-current={currentFor(link, active)}>
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Topbar no tablet/desktop; no celular (≤ 767px) ela some e entra o menu lateral (MobileMenu). */
export function Header() {
  const active = useActiveSection(SECTION_IDS);

  return (
    <header className={styles.header} data-experience-home>
      <nav className={styles.nav} aria-label="Principal">
        <NavList links={LINKS_START} active={active} />
        <Image
          src={logoTopbar}
          width={120}
          height={48}
          alt="Bruno & Benício"
          className={styles.logo}
        />
        <NavList links={LINKS_END} active={active} className={styles.listEnd} />
      </nav>
      <MobileMenu links={NAV_LINKS} active={active} />
    </header>
  );
}
