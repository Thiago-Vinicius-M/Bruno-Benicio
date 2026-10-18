"use client";

import { useEffect, useId, useState, useTransition, type FormEvent } from "react";
import { isAgendaError } from "@/lib/agenda/errors";
import type { ShowModelActionResult } from "@/lib/painel/showModels";
import { DESCRIPTION_MAX, DURATION_MAX, NAME_MAX, toShowModelRow } from "@/lib/showModels/modelInput";
import { formatPrice, parsePrice, priceInputValue } from "@/lib/showModels/price";
import type { ShowModel, ShowModelInput } from "@/lib/showModels/types";
import styles from "../Painel.module.css";
import videos from "../Videos/Videos.module.css";
import css from "./ShowModels.module.css";

type Props = {
  model?: ShowModel;
  save: (input: ShowModelInput) => Promise<ShowModelActionResult>;
  onSaved: (message: string) => void;
  onCancel: () => void;
  /** avisa o Dialog para não fechar no meio do envio */
  onBusyChange: (busy: boolean) => void;
};

const NETWORK_ERROR = "Não foi possível concluir a operação. Verifique a conexão e tente novamente.";

/**
 * Cadastro/edição de modelo de show. Valida no navegador com as mesmas regras do
 * servidor (lib/showModels/modelInput.ts) antes de enviar; o banco repete os checks.
 */
export function ShowModelForm({ model, save, onSaved, onCancel, onBusyChange }: Props) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [price, setPrice] = useState(model ? priceInputValue(model.price) : "");
  const [corporatePrice, setCorporatePrice] = useState(model ? priceInputValue(model.corporate_price) : "");
  const [active, setActive] = useState(true);

  useEffect(() => onBusyChange(pending), [pending, onBusyChange]);

  const parsedPrice = parsePrice(price);
  const parsedCorporate = parsePrice(corporatePrice);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const data = new FormData(event.currentTarget);
    const input: ShowModelInput = {
      name: String(data.get("name") ?? ""),
      duration: String(data.get("duration") ?? ""),
      description: String(data.get("description") ?? ""),
      price,
      corporatePrice,
      active,
    };
    try {
      toShowModelRow(input);
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
          Nome do modelo *
        </label>
        <input
          id={field("name")}
          name="name"
          required
          maxLength={NAME_MAX}
          autoComplete="off"
          placeholder="Voz e violão"
          defaultValue={model?.name}
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor={field("duration")} className={styles.label}>
          Duração *
        </label>
        <input
          id={field("duration")}
          name="duration"
          required
          maxLength={DURATION_MAX}
          autoComplete="off"
          placeholder="2h30 de show"
          defaultValue={model?.duration}
          className={styles.input}
        />
        <p className={styles.hint}>Aparece abaixo do nome, como no site hoje.</p>
      </div>

      <div className={styles.field}>
        <label htmlFor={field("description")} className={styles.label}>
          Descrição (opcional)
        </label>
        <textarea
          id={field("description")}
          name="description"
          rows={3}
          maxLength={DESCRIPTION_MAX}
          defaultValue={model?.description ?? ""}
          className={`${styles.input} ${css.textarea}`}
        />
        <p className={styles.hint}>Se preenchida, aparece em letras menores abaixo da duração.</p>
      </div>

      <div className={styles.field}>
        <label htmlFor={field("price")} className={styles.label}>
          Valor particular (R$) *
        </label>
        <input
          id={field("price")}
          name="price"
          required
          inputMode="decimal"
          autoComplete="off"
          placeholder="1.500,00"
          aria-describedby={field("price-hint")}
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          className={styles.input}
        />
        <p id={field("price-hint")} className={styles.hint} aria-live="polite">
          {price.trim() === ""
            ? "Em reais, com ou sem centavos (ex.: 1.500,00)."
            : parsedPrice === null
              ? "Valor inválido: use números, com até 2 casas decimais (ex.: 1.500,00)."
              : `Eventos particulares: ${formatPrice(parsedPrice)}`}
        </p>
      </div>

      <div className={styles.field}>
        <label htmlFor={field("corporate-price")} className={styles.label}>
          Valor corporativo (R$) *
        </label>
        <input
          id={field("corporate-price")}
          name="corporatePrice"
          required
          inputMode="decimal"
          autoComplete="off"
          placeholder="2.000,00"
          aria-describedby={field("corporate-price-hint")}
          value={corporatePrice}
          onChange={(event) => setCorporatePrice(event.target.value)}
          className={styles.input}
        />
        <p id={field("corporate-price-hint")} className={styles.hint} aria-live="polite">
          {corporatePrice.trim() === ""
            ? "Valor para eventos corporativos, independente do particular."
            : parsedCorporate === null
              ? "Valor inválido: use números, com até 2 casas decimais (ex.: 2.000,00)."
              : `Eventos corporativos: ${formatPrice(parsedCorporate)}`}
        </p>
      </div>

      {!model && (
        <label className={videos.check}>
          <input
            type="checkbox"
            checked={active}
            aria-describedby={field("active-hint")}
            onChange={(event) => setActive(event.target.checked)}
          />
          <span>
            <strong>Ativo</strong>
            <span id={field("active-hint")} className={styles.hint}>
              {active ? "Aparece no site assim que for salvo." : "Fica salvo, mas não aparece no site até ser ativado."}
            </span>
          </span>
        </label>
      )}

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
