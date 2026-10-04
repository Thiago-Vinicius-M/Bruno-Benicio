import type { FormState } from "@/lib/painel/authForms";
import styles from "./Painel.module.css";

/** Erro ou confirmação do formulário, anunciado por leitores de tela. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle") return <p role="status" aria-live="polite" hidden />;
  const isError = state.status === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      aria-live="polite"
      className={`${styles.alert} ${isError ? styles.alertError : styles.alertSuccess}`}
    >
      {state.message}
    </p>
  );
}
