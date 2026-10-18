"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFabHover, FAB_HOVER } from "@/animations/fabHover";
import { useGSAP } from "@/animations/gsap";
import { logoutAction } from "@/app/painel/actions";
import logo from "@/Imagens/BeB LOGO FUNDO PRETO_page-0001.png";
import { LINK_CREATOR_ROLES, ROLE_LABELS, type PanelUser } from "@/lib/painel/access";
import { NEW_COMMERCIAL_LINK_HREF, PANEL_ROUTES } from "@/lib/painel/routes";
import { isActiveNavItem, panelNavFor } from "./panelNav";
import styles from "./PanelShell.module.css";
import { ToastProvider } from "./Toast";

/**
 * Estrutura do painel: topo com marca e usuário, navegação lateral (gaveta no
 * celular/tablet) e conteúdo. `user` vem do servidor (perfil lido do banco); este
 * componente só exibe, não decide acesso.
 */
export function PanelShell({ user, children }: { user: PanelUser; children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const newLinkRef = useRef<HTMLAnchorElement>(null);
  const newLinkIconRef = useRef<HTMLSpanElement>(null);

  // Celular: "Gerar link" flutuante no canto inferior direito, com hover em GSAP.
  // FAB_HOVER como dependência: o Fast Refresh recria a animação quando os parâmetros mudam.
  useGSAP(
    () => {
      if (!newLinkRef.current || !newLinkIconRef.current) return;
      const mm = createFabHover(newLinkRef.current, newLinkIconRef.current, FAB_HOVER);
      return () => mm.revert();
    },
    { dependencies: [FAB_HOVER, user.role] },
  );

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="painel-nav"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className={styles.menuIcon} data-open={menuOpen || undefined} aria-hidden="true" />
        </button>

        <Link href={PANEL_ROUTES.home} className={styles.brand} onClick={closeMenu} aria-label="Bruno e Benicio: início do painel">
          <Image src={logo} alt="" width={64} height={26} className={styles.brandLogo} />
          <span>Bruno e Benicio</span>
        </Link>

        <div className={styles.user}>
          {/* Atalho principal de quem vende: abre o formulário de novo link de qualquer tela.
              No celular vira o botão flutuante redondo do canto inferior direito. */}
          {LINK_CREATOR_ROLES.includes(user.role) && (
            <Link
              ref={newLinkRef}
              href={NEW_COMMERCIAL_LINK_HREF}
              className={styles.newLink}
              aria-label="Gerar link"
              onClick={closeMenu}
            >
              <span ref={newLinkIconRef} className={styles.newLinkIcon} aria-hidden="true">
                +
              </span>
              <span className={styles.newLinkText} aria-hidden="true">
                Gerar link
              </span>
            </Link>
          )}
          <p className={styles.userInfo}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userRole}>{ROLE_LABELS[user.role]}</span>
          </p>
          <form action={logoutAction}>
            <button type="submit" className={styles.logout}>
              Sair
            </button>
          </form>
        </div>
      </header>

      <nav
        id="painel-nav"
        aria-label="Painel"
        className={styles.sidebar}
        data-open={menuOpen || undefined}
      >
        <ul className={styles.navList}>
          {panelNavFor(user.role).map((item) => (
            <li key={item.label}>
              {item.href ? (
                <Link
                  href={item.href}
                  className={styles.navLink}
                  aria-current={isActiveNavItem(item, pathname) ? "page" : undefined}
                  onClick={closeMenu}
                >
                  {item.label}
                </Link>
              ) : (
                <span className={styles.navLink} aria-disabled="true">
                  {item.label}
                  <span className={styles.soon}>Em breve</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {menuOpen && <div className={styles.backdrop} onClick={closeMenu} aria-hidden="true" />}

      <main className={styles.content}>
        <ToastProvider>{children}</ToastProvider>
      </main>
    </div>
  );
}
