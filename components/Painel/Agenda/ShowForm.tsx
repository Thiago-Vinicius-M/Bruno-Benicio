"use client";

import { useState, type FormEvent } from "react";
import { isAgendaError } from "@/lib/agenda/errors";
import { toShowRow } from "@/lib/agenda/showsRepository";
import type { Show, ShowInput } from "@/lib/agenda/types";
import { formatShowTime } from "@/lib/painel/showFormat";
import styles from "../Painel.module.css";

/**
 * Campos do show: data (calendário, `YYYY-MM-DD` direto do input, sem Date/fuso),
 * horário (`HH:MM`), local e Instagram. A validação é a mesma do repositório
 * (`toShowRow`); o banco continua sendo a autoridade final.
 */
export function ShowForm({
  show,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  show?: Show;
  pending: boolean;
  error?: string;
  onSubmit: (input: ShowInput) => void;
  onCancel: () => void;
}) {
  const [validationError, setValidationError] = useState<string>();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const input: ShowInput = {
      showDate: String(data.get("showDate") ?? ""),
      showTime: String(data.get("showTime") ?? ""),
      venueName: String(data.get("venueName") ?? ""),
      venueInstagram: String(data.get("venueInstagram") ?? ""),
    };
    try {
      toShowRow(input);
    } catch (problem) {
      setValidationError(isAgendaError(problem) ? problem.message : "Dados inválidos.");
      return;
    }
    setValidationError(undefined);
    onSubmit(input);
  }

  const message = validationError ?? error;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {message && (
        <p role="alert" className={`${styles.alert} ${styles.alertError}`}>
          {message}
        </p>
      )}

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="showDate" className={styles.label}>
            Data *
          </label>
          <input
            id="showDate"
            name="showDate"
            type="date"
            required
            defaultValue={show?.show_date}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="showTime" className={styles.label}>
            Horário *
          </label>
          <input
            id="showTime"
            name="showTime"
            type="time"
            required
            defaultValue={show ? formatShowTime(show.show_time) : undefined}
            className={styles.input}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="venueName" className={styles.label}>
          Nome do local *
        </label>
        <input
          id="venueName"
          name="venueName"
          required
          maxLength={160}
          autoComplete="off"
          defaultValue={show?.venue_name}
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="venueInstagram" className={styles.label}>
          Instagram da casa
        </label>
        <input
          id="venueInstagram"
          name="venueInstagram"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="@casadoevento"
          aria-describedby="venueInstagram-hint"
          defaultValue={show?.venue_instagram ? `@${show.venue_instagram}` : undefined}
          className={styles.input}
        />
        <p id="venueInstagram-hint" className={styles.hint}>
          Opcional. Aceita @usuario, usuario ou o link do perfil.
        </p>
      </div>

      <div className={styles.dialogActions}>
        <button type="button" className={`${styles.button} ${styles.buttonGhost}`} onClick={onCancel} disabled={pending}>
          Cancelar
        </button>
        <button type="submit" className={styles.button} disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
