"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { updateVideoHomeLimitsAction } from "@/app/painel/(area)/videos/actions";
import { HOME_LIMIT_RANGE, parseHomeLimit } from "@/lib/videos/gallery";
import type { VideoHomeLimits } from "@/lib/videos/types";
import styles from "../Painel.module.css";
import { useToast } from "../Toast";
import css from "./Videos.module.css";

const NETWORK_ERROR = "Não foi possível concluir a operação. Verifique a conexão e tente novamente.";

/**
 * Quantos vídeos a Home mostra no desktop/tablet e no celular (principal incluído). O que
 * passar do limite vai para o "Ver mais". Validado aqui, na Server Action e no banco.
 */
export function HomeLimitsForm({ limits }: { limits: VideoHomeLimits }) {
  const id = useId();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [desktop, setDesktop] = useState(String(limits.desktop));
  const [mobile, setMobile] = useState(String(limits.mobile));
  const [error, setError] = useState<string>();

  const changed = desktop !== String(limits.desktop) || mobile !== String(limits.mobile);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = { desktop: parseHomeLimit(desktop), mobile: parseHomeLimit(mobile) };
    if (values.desktop === null || values.mobile === null) {
      setError(`Use números inteiros de ${HOME_LIMIT_RANGE.min} a ${HOME_LIMIT_RANGE.max}.`);
      return;
    }
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await updateVideoHomeLimitsAction(values);
        if (result.status === "success") toast(result.message);
        else setError(result.message);
      } catch {
        setError(NETWORK_ERROR);
      }
    });
  }

  const field = (name: string) => `${id}-${name}`;

  return (
    <form className={css.limits} onSubmit={handleSubmit} noValidate aria-labelledby={field("title")}>
      <div className={css.limitsHeader}>
        <h2 id={field("title")} className={css.limitsTitle}>
          Vídeos na Home
        </h2>
        <p className={styles.hint}>
          Quantos vídeos aparecem na Home em cada tela, contando o principal ({HOME_LIMIT_RANGE.min} a{" "}
          {HOME_LIMIT_RANGE.max}). Os que passarem vão para o “Ver mais”.
        </p>
      </div>
      {error && (
        <p role="alert" className={`${styles.alert} ${styles.alertError}`}>
          {error}
        </p>
      )}
      <div className={css.limitsFields}>
        <div className={styles.field}>
          <label htmlFor={field("desktop")} className={styles.label}>
            Computador e tablet
          </label>
          <input
            id={field("desktop")}
            type="number"
            inputMode="numeric"
            min={HOME_LIMIT_RANGE.min}
            max={HOME_LIMIT_RANGE.max}
            step={1}
            required
            value={desktop}
            onChange={(event) => setDesktop(event.target.value)}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={field("mobile")} className={styles.label}>
            Celular
          </label>
          <input
            id={field("mobile")}
            type="number"
            inputMode="numeric"
            min={HOME_LIMIT_RANGE.min}
            max={HOME_LIMIT_RANGE.max}
            step={1}
            required
            value={mobile}
            onChange={(event) => setMobile(event.target.value)}
            className={styles.input}
          />
        </div>
        <button type="submit" className={`${styles.button} ${css.limitsSave}`} disabled={pending || !changed}>
          {pending ? "Salvando…" : "Salvar limites"}
        </button>
      </div>
    </form>
  );
}
