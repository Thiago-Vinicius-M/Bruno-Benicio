"use client";

import Image from "next/image";
import styles from "./Header.module.css";
import logoTopbar from "@/Imagens/BeB LOGO FUNDO PRETO_page-0001.png";
import { MobileMenu } from "./MobileMenu";
import { currentFor, navFor, type NavLink } from "./navLinks";
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

/**
 * Topbar no tablet/desktop; no celular (≤ 767px) ela some e entra o menu lateral (MobileMenu).
 * `agenda`: a agenda está habilitada no painel → link AGENDA (topbar e gaveta).
 */
export function Header({ agenda = false }: { agenda?: boolean }) {
  const nav = navFor(agenda);
  const active = useActiveSection(nav.sectionIds);

  return (
    <header className={styles.header} data-experience-home>
      <nav className={styles.nav} aria-label="Principal">
        <NavList links={nav.start} active={active} />
        <Image
          src={logoTopbar}
          width={120}
          height={48}
          alt="Bruno & Benício"
          className={styles.logo}
        />
        {/* Com menos links que o lado esquerdo, o grupo da direita não vai para as pontas. */}
        <NavList
          links={nav.end}
          active={active}
          className={nav.end.length < nav.start.length ? styles.listEnd : undefined}
        />
      </nav>
      <MobileMenu links={nav.all} active={active} />
    </header>
  );
}
