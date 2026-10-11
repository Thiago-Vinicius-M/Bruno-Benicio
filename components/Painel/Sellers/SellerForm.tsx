"use client";

import { useEffect, useId, useState, useTransition, type FormEvent } from "react";
import { isAgendaError } from "@/lib/agenda/errors";
import type { SellerActionResult } from "@/lib/painel/sellers";
import { SELLER_NAME_MAX, toSellerRow } from "@/lib/sellers/sellerInput";
import type { Seller, SellerInput } from "@/lib/sellers/types";
import { formatWhatsApp, normalizeWhatsApp } from "@/lib/whatsapp";
import styles from "../Painel.module.css";

type Props = {
  seller?: Seller;
  save: (input: SellerInput) => Promise<SellerActionResult>;
  onSaved: (message: string) => void;
  onCancel: () => void;
  /** avisa o Dialog para não fechar no meio do envio */
  onBusyChange: (busy: boolean) => void;
};

const NETWORK_ERROR = "Não foi possível concluir a operação. Verifique a conexão e tente novamente.";

/**
 * Cadastro/edição de vendedor: nome e WhatsApp (com código do país e DDD). O número é
 * normalizado (só dígitos) antes de salvar; o link é gerado pelo banco e não muda.
 */
export function SellerForm({ seller, save, onSaved, onCancel, onBusyChange }: Props) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [whatsapp, setWhatsapp] = useState(seller ? formatWhatsApp(seller.whatsapp) : "");

  useEffect(() => onBusyChange(pending), [pending, onBusyChange]);

  const checked = whatsapp.trim() ? normalizeWhatsApp(whatsapp) : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const input: SellerInput = { name: String(new FormData(event.currentTarget).get("name") ?? ""), whatsapp };
    try {
      toSellerRow(input);
    } catch (invalid) {
      setError(isAgendaError(invalid) ? invalid.message : "Dados inválidos.");
      return;
    }
    setError(undefined);

    startTransition(async () => {
      try {
        const result = await save(input);
        if (result.status === "success") onSaved(result.message);
        else setError(result.message);
      } catch {
        setError(NETWORK_ERROR);
      }
    });
  }

  const field = (name: string) => `${id}-${name}`;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {error && (
        <p role="alert" className={`${styles.alert} ${styles.alertError}`}>
          {error}
        </p>
      )}

      <div className={styles.field}>
        <label htmlFor={field("name")} className={styles.label}>
          Nome *
        </label>
        <input
          id={field("name")}
          name="name"
          required
          maxLength={SELLER_NAME_MAX}
          autoComplete="off"
          defaultValue={seller?.name}
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor={field("whatsapp")} className={styles.label}>
          WhatsApp *
        </label>
        <input
          id={field("whatsapp")}
          name="whatsapp"
          type="tel"
          inputMode="tel"
          required
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

      {seller && <p className={styles.hint}>O link deste vendedor continua o mesmo depois de salvar.</p>}

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
