import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/painel/actions";
import { AuthCard } from "@/components/Painel/AuthCard";
import styles from "@/components/Painel/Painel.module.css";
import { DENIED_MESSAGES } from "@/lib/painel/access";
import { PANEL_ROUTES } from "@/lib/painel/routes";
import { getPanelAccess } from "@/lib/painel/session";

export const metadata: Metadata = { title: "Acesso negado" };

/**
 * Dois casos, sempre decididos pelo estado real no banco (a URL só escolhe o texto):
 * - sessão sem perfil ativo: oferece sair (sem voltar ao login, evitando loop);
 * - perfil ativo sem papel suficiente (`?motivo=admin`): oferece voltar ao painel.
 */
export default async function AccessDeniedPage({ searchParams }: PageProps<"/painel/acesso-negado">) {
  const access = await getPanelAccess();
  if (access.status === "anonymous") redirect(PANEL_ROUTES.login);

  if (access.status === "granted") {
    const { motivo } = await searchParams;
    if (motivo !== "admin" || access.user.role === "ADMIN") redirect(PANEL_ROUTES.home);
    return (
      <AuthCard title="Acesso negado" lead="Esta área é exclusiva para administradores.">
        <Link href={PANEL_ROUTES.home} className={styles.button}>
          Voltar ao painel
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Acesso negado" lead={DENIED_MESSAGES[access.reason]}>
      <form action={logoutAction} className={styles.form}>
        <button type="submit" className={styles.button}>
          Sair
        </button>
      </form>
    </AuthCard>
  );
}
