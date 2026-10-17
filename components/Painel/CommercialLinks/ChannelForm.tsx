"use client";

import { useEffect, useId, useState, useTransition, type FormEvent } from "react";
import { isAgendaError } from "@/lib/agenda/errors";
import { CHANNEL_LABEL_MAX, normalizeChannelLabel } from "@/lib/commercialLinks/channelInput";
import type { ChannelOwner, WhatsAppChannel } from "@/lib/commercialLinks/types";
import type { ActionResult } from "@/lib/painel/actionResult";
import { ROLE_LABELS } from "@/lib/painel/access";
import { formatWhatsApp, normalizeWhatsApp } from "@/lib/whatsapp";
import styles from "../Painel.module.css";
import css from "./CommercialLinks.module.css";

export type ChannelFormInput = { ownerId: string; whatsapp: string; label: string; isPrimary: boolean };

type Props = {
  /** Edição: só identificação e principal (número e dono não mudam). */
  channel?: WhatsAppChannel;
  owners: ChannelOwner[];
  ownerName?: string;
  save: (input: ChannelFormInput) => Promise<ActionResult>;
  onSaved: (message: string) => void;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
};

const NETWORK_ERROR = "Não foi possível concluir a operação. Verifique a conexão e tente novamente.";

/** Cadastro (dono, número, identificação, principal) ou edição (identificação, principal) de um WhatsApp. */
export function ChannelForm({ channel, owners, ownerName, save, onSaved, onCancel, onBusyChange }: Props) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [ownerId, setOwnerId] = useState(channel?.owner_id ?? "");
  const [whatsapp, setWhatsapp] = useState(channel ? formatWhatsApp(channel.whatsapp) : "");
  const [label, setLabel] = useState(channel?.label ?? "");
  const [isPrimary, setIsPrimary] = useState(channel?.is_primary ?? false);

  useEffect(() => onBusyChange(pending), [pending, onBusyChange]);

  const field = (name: string) => `${id}-${name}`;
  const checked = !channel && whatsapp.trim() ? normalizeWhatsApp(whatsapp) : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!channel) {
      if (!ownerId) return setError("Escolha o usuário dono deste WhatsApp.");
      const number = normalizeWhatsApp(whatsapp);
      if (!number.ok) return setError(number.message);
    }
    try {
      normalizeChannelLabel(label);
    } catch (problem) {
      return setError(isAgendaError(problem) ? problem.message : "Dados inválidos.");
    }
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await save({ ownerId, whatsapp, label, isPrimary });
        if (result.status === "success") onSaved(result.message);
        else setError(result.message);
      } catch {
        setError(NETWORK_ERROR);
      }
    });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {error && (
        <p role="alert" className={`${styles.alert} ${styles.alertError}`}>
          {error}
        </p>
      )}

      {channel ? (
        <p className={css.meta}>
          {ownerName} · {formatWhatsApp(channel.whatsapp)}. Para outro número, cadastre um novo WhatsApp.
        </p>
      ) : (
        <>
          <div className={styles.field}>
            <label htmlFor={field("owner")} className={styles.label}>
              Usuário *
            </label>
            <select
              id={field("owner")}
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              className={styles.input}
            >
              <option value="">Escolha…</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name} ({ROLE_LABELS[owner.role]})
                </option>
              ))}
            </select>
            {owners.length === 0 && (
              <p className={styles.hint}>Nenhum usuário Administrador ou Vendedor ativo. Perfis são criados pelo SQL Editor.</p>
            )}
          </div>
          <div className={styles.field}>
            <label htmlFor={field("whatsapp")} className={styles.label}>
              WhatsApp *
            </label>
            <input
              id={field("whatsapp")}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="+55 62 99999-9999"
              aria-describedby={field("whatsapp-hint")}
              value={whatsapp}
              onChange={(event) => setWhatsapp(event.target.value)}
              className={styles.input}
            />
            <p id={field("whatsapp-hint")} className={styles.hint} aria-live="polite">
              {!checked
                ? "Com o código do país e o DDD: +55 para o Brasil."
                : checked.ok
                  ? `A conversa abre em ${formatWhatsApp(checked.digits)}.`
                  : checked.message}
            </p>
          </div>
        </>
      )}

      <div className={styles.field}>
        <label htmlFor={field("label")} className={styles.label}>
          Identificação *
        </label>
        <input
          id={field("label")}
          maxLength={CHANNEL_LABEL_MAX}
          autoComplete="off"
          placeholder="Ex.: Comercial"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className={styles.input}
        />
      </div>

      <label className={css.option}>
        <input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} />
        <span className={css.optionText}>
          <strong>Principal</strong>
          <span className={styles.hint}>Aparece primeiro na lista. A escolha do WhatsApp continua obrigatória em cada link.</span>
        </span>
      </label>

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
