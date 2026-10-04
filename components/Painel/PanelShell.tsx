"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { logoutAction } from "@/app/painel/actions";
import logo from "@/Imagens/BeB LOGO FUNDO PRETO_page-0001.png";
import { ROLE_LABELS, type PanelUser } from "@/lib/painel/access";
import { PANEL_ROUTES } from "@/lib/painel/routes";
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
