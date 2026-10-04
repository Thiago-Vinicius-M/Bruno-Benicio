"use client";

import { useActionState, useState } from "react";
import { recoverPasswordAction } from "@/app/painel/actions";
import { IDLE } from "@/lib/painel/authForms";
import { FormMessage } from "./FormMessage";
import styles from "./Painel.module.css";

export function RecoverPasswordForm({ action = recoverPasswordAction }: { action?: typeof recoverPasswordAction }) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const [email, setEmail] = useState("");

  return (
    <form action={formAction} className={styles.form} noValidate>
      <FormMessage state={state} />

      <div className={styles.field}>
        <label htmlFor="email" className={styles.label}>
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={styles.input}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <button type="submit" className={styles.button} disabled={pending}>
        {pending ? "Enviando…" : "Enviar link"}
      </button>
    </form>
  );
}
