import type { Metadata } from "next";
import { AuthCard } from "@/components/Painel/AuthCard";
import { LoginForm } from "@/components/Painel/LoginForm";
import styles from "@/components/Painel/Painel.module.css";

export const metadata: Metadata = { title: "Entrar" };

/** Mensagens por código fixo: o texto da URL nunca é exibido diretamente. */
const NOTICES: Record<string, string> = {
  link: "O link é inválido ou expirou. Solicite um novo em “Esqueci minha senha”.",
};

export default async function LoginPage({ searchParams }: PageProps<"/painel/login">) {
  const { erro } = await searchParams;
  const notice = typeof erro === "string" ? NOTICES[erro] : undefined;

  return (
    <AuthCard title="Painel" lead="Entre com seu e-mail e senha.">
      {notice && (
        <p role="alert" className={`${styles.alert} ${styles.alertError} ${styles.notice}`}>
          {notice}
        </p>
      )}
      <LoginForm />
    </AuthCard>
  );
}
