"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AuthCard } from "@/components/Painel/AuthCard";
import styles from "@/components/Painel/Painel.module.css";
import { PANEL_ROUTES } from "@/lib/painel/routes";

/**
 * Falha inesperada no painel (ex.: Supabase fora do ar ao validar a sessão). Em produção
 * o Next não envia a mensagem do erro ao navegador, só o `digest` para cruzar com o log.
 */
export default function PainelError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[painel]", error);
  }, [error]);

  return (
    <AuthCard title="Algo deu errado" lead="Não foi possível carregar o painel agora. Tente novamente em instantes.">
      <div className={styles.form}>
        <button type="button" className={styles.button} onClick={() => retry()}>
          Tentar novamente
        </button>
        <Link href={PANEL_ROUTES.login} className={styles.link}>
          Ir para o login
        </Link>
      </div>
    </AuthCard>
  );
}
