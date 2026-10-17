"use client";

import Image from "next/image";
import styles from "./Header.module.css";
import logoTopbar from "@/Imagens/BeB LOGO FUNDO PRETO_page-0001.png";
import { hidesDirectContact, useCommercial } from "@/components/Show/commercialContext";
import { CONTACT_INSTAGRAM } from "@/components/Contact/contactContent";
import { InstagramIcon } from "@/components/Icons/InstagramIcon";
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
 * Na proposta comercial (link válido), o link CONTATO sai do menu. O Instagram fica no
 * canto direito nas duas versões (pílula no desktop; botão redondo no celular).
 */
export function Header({ agenda = false }: { agenda?: boolean }) {
  const nav = navFor(agenda, !hidesDirectContact(useCommercial()));
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
      {/* Link externo, não uma seção: botão em pílula no canto direito, separado da navegação. */}
      <a
        href={CONTACT_INSTAGRAM.url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.instagram}
        aria-label={`Instagram ${CONTACT_INSTAGRAM.handle} (abre em nova aba)`}
      >
        <InstagramIcon className={styles.instagramIcon} />
        <span className={styles.instagramHandle}>{CONTACT_INSTAGRAM.handle}</span>
      </a>
    </header>
  );
}
