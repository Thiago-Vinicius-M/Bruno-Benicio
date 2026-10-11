"use client";

import { useId } from "react";
import { formatPrice } from "@/lib/showModels/price";
import type { CommercialShowModel } from "@/lib/showModels/types";
import type { WhatsAppReturnState } from "./useWhatsAppReturn";
import styles from "./Show.module.css";

type Props = {
  selected: CommercialShowModel | null;
  /** "AAAA-MM-DD" do campo nativo, ou "". */
  date: string;
  /** "HH:MM" do campo nativo, ou "". */
  time: string;
  state: WhatsAppReturnState;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onRetry: () => void;
};

/**
 * Data e horário opcionais do evento + "Voltar ao WhatsApp". Os campos aparecem depois
 * da escolha do formato. O botão fica desabilitado até a mensagem estar pronta; então
 * vira um link de verdade (wa.me), que abre o app no celular e o WhatsApp Web no
 * computador, com a mensagem preenchida para o contratante revisar e enviar.
 */
export function WhatsAppReturn({
  selected,
  date,
  time,
  state,
  onDateChange,
  onTimeChange,
  onRetry,
}: Props) {
  const id = useId();
  const statusId = `${id}-status`;

  let status: string;
  if (!selected)
    status = "Escolha um formato acima para voltar ao WhatsApp com ele.";
  else if (state.status === "error") status = state.message;
  else if (state.status === "loading") status = "Preparando a mensagem…";
  else
    status = `Formato escolhido: ${selected.name} · ${formatPrice(selected.price)}`;

  return (
    <div className={styles.whatsapp}>
      {selected && (
        <fieldset className={styles.schedule}>
          <legend className={`type-nav ${styles.scheduleLegend}`}>
            Data e horário do evento · opcionais
          </legend>
          <label className={styles.scheduleField}>
            <span className={styles.scheduleLabel}>Data</span>
            <input
              type="date"
              name="data-do-evento"
              value={date}
              onChange={(event) => onDateChange(event.target.value)}
              className={styles.scheduleInput}
            />
          </label>
          <label className={styles.scheduleField}>
            <span className={styles.scheduleLabel}>Horário</span>
            <input
              type="time"
              name="horario-do-evento"
              value={time}
              onChange={(event) => onTimeChange(event.target.value)}
              className={styles.scheduleInput}
            />
          </label>
        </fieldset>
      )}

      {state.status === "ready" ? (
        <a
          href={state.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.whatsappButton}
          aria-describedby={statusId}
        >
          Voltar ao WhatsApp
          <span className={styles.srOnly}> (abre em nova aba)</span>
        </a>
      ) : state.status === "error" && state.retry ? (
        <button
          type="button"
          className={styles.whatsappButton}
          onClick={onRetry}
          aria-describedby={statusId}
        >
          Tentar novamente
        </button>
      ) : (
        <button
          type="button"
          className={styles.whatsappButton}
          disabled
          aria-describedby={statusId}
        >
          Voltar ao WhatsApp
        </button>
      )}
      <p
        id={statusId}
        className={styles.whatsappStatus}
        data-tone={state.status === "error" ? "error" : undefined}
        aria-live="polite"
      >
        {status}
      </p>
    </div>
  );
}
