"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction } from "@/app/painel/actions";
import { IDLE } from "@/lib/painel/authForms";
import { PANEL_ROUTES } from "@/lib/painel/routes";
import { FormMessage } from "./FormMessage";
import styles from "./Painel.module.css";

export function LoginForm({ action = loginAction }: { action?: typeof loginAction }) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  // Controlado: o React limpa o formulário após cada envio, mas o e-mail deve ficar.
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
          autoComplete="username"
          required
          className={styles.input}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="password" className={styles.label}>
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={styles.input}
        />
      </div>

      <button type="submit" className={styles.button} disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>

      <p className={styles.authFooter}>
        <Link href={PANEL_ROUTES.recoverPassword} className={styles.link}>
          Esqueci minha senha
        </Link>
      </p>
    </form>
  );
}
