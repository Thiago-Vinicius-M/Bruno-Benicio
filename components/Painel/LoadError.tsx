"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import agenda from "./Agenda/Agenda.module.css";
import styles from "./Painel.module.css";

/** Falha ao carregar uma lista do painel: tenta de novo buscando os dados no servidor. */
export function LoadError({ message }: { message: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className={agenda.state} role="alert">
      <p>{message}</p>
      <button
        type="button"
        className={styles.button}
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {pending ? "Carregando…" : "Tentar novamente"}
      </button>
    </div>
  );
}
