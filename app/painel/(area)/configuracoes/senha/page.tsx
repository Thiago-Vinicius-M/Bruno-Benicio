import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/Painel/ChangePasswordForm";
import styles from "@/components/Painel/Painel.module.css";
import { requirePanelUser } from "@/lib/painel/session";

export const metadata: Metadata = { title: "Alterar senha" };

export default async function ChangePasswordPage({ searchParams }: PageProps<"/painel/configuracoes/senha">) {
  await requirePanelUser();
  const { recuperacao, convite } = await searchParams;
  const [title, lead] = convite
    ? ["Criar sua senha", "Bem-vindo ao painel. Defina sua senha para os próximos acessos."]
    : recuperacao
      ? ["Criar nova senha", "Defina a nova senha para concluir a recuperação."]
      : ["Alterar senha", "Configurações da sua conta."];

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{title}</h1>
        <p className={styles.pageLead}>{lead}</p>
      </header>

      <section className={styles.panel} aria-label="Nova senha">
        <ChangePasswordForm />
      </section>
    </>
  );
}
