import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/Painel/AuthCard";
import styles from "@/components/Painel/Painel.module.css";
import { RecoverPasswordForm } from "@/components/Painel/RecoverPasswordForm";
import { PANEL_ROUTES } from "@/lib/painel/routes";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecoverPasswordPage() {
  return (
    <AuthCard title="Recuperar senha" lead="Informe seu e-mail para receber um link de redefinição.">
      <RecoverPasswordForm />
      <p className={styles.authFooter}>
        <Link href={PANEL_ROUTES.login} className={styles.link}>
          Voltar para o login
        </Link>
      </p>
    </AuthCard>
  );
}
