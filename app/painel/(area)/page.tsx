import Link from "next/link";
import styles from "@/components/Painel/Painel.module.css";
import { panelNavFor } from "@/components/Painel/panelNav";
import { ROLE_LABELS } from "@/lib/painel/access";
import { PANEL_ROUTES } from "@/lib/painel/routes";
import { requirePanelUser } from "@/lib/painel/session";

/** Início do painel: atalhos para as seções. Não consulta shows nem dados financeiros. */
export default async function PainelHomePage() {
  const user = await requirePanelUser();
  const sections = panelNavFor(user.role).filter(
    (item) => item.href !== PANEL_ROUTES.home && item.href !== PANEL_ROUTES.changePassword,
  );

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Olá, {user.name}</h1>
        <p className={styles.pageLead}>Perfil: {ROLE_LABELS[user.role]}</p>
      </header>

      <ul className={styles.cards} aria-label="Seções do painel">
        {sections.map((item) => (
          <li key={item.label}>
            {item.href ? (
              <Link href={item.href} className={`${styles.card} ${styles.cardLink}`}>
                <span className={styles.cardTitle}>{item.label}</span>
                <span className={styles.cardText}>Abrir</span>
              </Link>
            ) : (
              <div className={styles.card} aria-disabled="true">
                <span className={styles.cardTitle}>{item.label}</span>
                <span className={styles.cardText}>Em breve</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
