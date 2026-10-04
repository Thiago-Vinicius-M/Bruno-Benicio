"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/painel/actions";
import { IDLE } from "@/lib/painel/authForms";
import { FormMessage } from "./FormMessage";
import styles from "./Painel.module.css";

/** Os campos não são controlados: o React os limpa após cada envio, e a senha nunca volta do servidor. */
export function ChangePasswordForm({ action = changePasswordAction }: { action?: typeof changePasswordAction }) {
  const [state, formAction, pending] = useActionState(action, IDLE);

  return (
    <form action={formAction} className={styles.form} noValidate>
      <FormMessage state={state} />

      <div className={styles.field}>
        <label htmlFor="password" className={styles.label}>
          Nova senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          aria-describedby="password-hint"
          className={styles.input}
        />
        <p id="password-hint" className={styles.hint}>
          Mínimo de 8 caracteres.
        </p>
      </div>

      <div className={styles.field}>
        <label htmlFor="confirmation" className={styles.label}>
          Confirmar nova senha
        </label>
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={styles.input}
        />
      </div>

      <div>
        <button type="submit" className={styles.button} disabled={pending}>
          {pending ? "Salvando…" : "Alterar senha"}
        </button>
      </div>
    </form>
  );
}
