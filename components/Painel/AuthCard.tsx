import Image from "next/image";
import type { ReactNode } from "react";
import logo from "@/Imagens/BeB LOGO FUNDO PRETO_page-0001.png";
import styles from "./Painel.module.css";

/** Moldura das páginas públicas do painel (login, recuperação, acesso negado). */
export function AuthCard({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <main className={styles.authPage}>
      <section className={styles.authCard} aria-labelledby="auth-title">
        <Image src={logo} alt="Bruno & Benício" width={96} height={38} className={styles.authLogo} priority />
        <h1 id="auth-title" className={styles.authTitle}>
          {title}
        </h1>
        {lead && <p className={styles.authLead}>{lead}</p>}
        {children}
      </section>
    </main>
  );
}
