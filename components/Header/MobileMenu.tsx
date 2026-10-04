"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createDrawer } from "@/animations/drawer";
import { useGSAP } from "@/animations/gsap";
import { MEDIA } from "@/animations/media";
import logo from "@/Imagens/BeB LOGO FUNDO PRETO_page-0001.png";
import { MOBILE_MENU_DRAWER } from "./mobileMenuDrawer";
import { currentFor, type NavLink } from "./navLinks";
import styles from "./Header.module.css";

const NAV_ID = "menu-lateral";

/**
 * Menu do celular (≤ 767px; escondido por CSS nas telas maiores): botão de 3 linhas no
 * canto superior esquerdo que abre uma gaveta lateral com as seções.
 *
 * Os itens são os mesmos links de âncora da topbar, então a navegação é a mesma do
 * desktop (inclusive o atalho de #videos em Videos.tsx). Ao tocar num item, a gaveta fecha
 * e o navegador leva até a seção. Fecha também pelo botão, pelo overlay e com Esc.
 */
export function MobileMenu({ links, active }: { links: NavLink[]; active: string }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const drawerRef = useRef<ReturnType<typeof createDrawer>>(null);
  const close = () => setOpen(false);

  useGSAP(
    () => {
      const drawer = createDrawer(
        {
          overlay: overlayRef.current!,
          panel: panelRef.current!,
          items: Array.from(listRef.current!.children) as HTMLElement[],
        },
        MOBILE_MENU_DRAWER,
      );
      drawerRef.current = drawer;
      return () => {
        drawer.mm.revert();
        drawerRef.current = null;
      };
    },
    { dependencies: [MOBILE_MENU_DRAWER], revertOnUpdate: true },
  );

  useEffect(() => {
    if (open) drawerRef.current?.open();
    else drawerRef.current?.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Ao passar para tablet/desktop (ex.: girar o aparelho) o menu fecha.
  useEffect(() => {
    const mobile = window.matchMedia(MEDIA.isMobile);
    const onChange = () => {
      if (!mobile.matches) setOpen(false);
    };
    mobile.addEventListener("change", onChange);
    return () => mobile.removeEventListener("change", onChange);
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.menuButton}
        aria-expanded={open}
        aria-controls={NAV_ID}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.menuIcon} data-open={open || undefined} aria-hidden="true" />
      </button>

      <div ref={overlayRef} className={styles.overlay} onClick={close} aria-hidden="true" />

      <nav ref={panelRef} id={NAV_ID} className={styles.drawer} aria-label="Principal">
        <ul ref={listRef} className={styles.drawerList}>
          {links.map((link) => (
            <li key={link.href}>
              <a href={link.href} className={styles.drawerLink} aria-current={currentFor(link, active)} onClick={close}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <Image src={logo} width={96} height={38} alt="Bruno & Benício" className={styles.drawerLogo} />
      </nav>
    </>
  );
}
