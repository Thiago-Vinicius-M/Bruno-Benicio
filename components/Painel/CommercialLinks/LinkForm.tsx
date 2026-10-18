"use client";

import { useEffect, useId, useState, useTransition, type FormEvent } from "react";
import { agendaNow } from "@/lib/agenda/dates";
import { isAgendaError } from "@/lib/agenda/errors";
import {
  checkCustomExpiry,
  LINK_LABEL_MAX,
  LINK_MAX_MS,
  LINK_VALIDITY_OPTIONS,
  normalizeLinkLabel,
} from "@/lib/commercialLinks/linkInput";
import type { LinkModel, LinkValidity, PriceTier, WhatsAppChannel } from "@/lib/commercialLinks/types";
import type { CreateCommercialLinkResult } from "@/lib/painel/commercialLinks";
import { formatTimestamp } from "@/lib/painel/showFormat";
import { sellerLinkUrl } from "@/lib/sellers/sellerLink";
import { formatPrice, parsePrice, priceInputValue } from "@/lib/showModels/price";
import { formatWhatsApp } from "@/lib/whatsapp";
import styles from "../Painel.module.css";
import css from "./CommercialLinks.module.css";
import { ShareLinkButtons } from "./ShareLinkButtons";

/** O que o formulário envia para a Server Action (o servidor valida tudo de novo). */
export type CommercialLinkFormInput = {
  channelId: string;
  label: string;
  validity: LinkValidity;
  date: string;
  time: string;
  /** Só escolhe o valor de partida (particular ou corporativo) de cada modelo. */
  tier: PriceTier;
  /** `price` só quando difere do padrão do tipo; ausente = padrão do tipo (decidido pelo banco). */
  items: { modelId: string; price?: number }[];
};

type Props = {
  /** Canais ATIVOS do próprio usuário. Nenhum vem pré-selecionado: a escolha é obrigatória. */
  channels: WhatsAppChannel[];
  models: LinkModel[];
  canCustomizePrices: boolean;
  siteOrigin: string;
  save: (input: CommercialLinkFormInput) => Promise<CreateCommercialLinkResult>;
  onCopy: (url: string) => void;
  /** Cancelar ou concluir (depois de copiar o link). */
  onDone: () => void;
  /** avisa o Dialog para não fechar no meio do envio */
  onBusyChange: (busy: boolean) => void;
};

const NETWORK_ERROR = "Não foi possível concluir a operação. Verifique a conexão e tente novamente.";
const DAY_MS = 24 * 3_600_000;

const TIER_OPTIONS: { value: PriceTier; label: string }[] = [
  { value: "private", label: "Particular" },
  { value: "corporate", label: "Corporativo" },
];

/** Valor padrão do modelo para o tipo de evento. */
const tierPrice = (model: LinkModel, tier: PriceTier) => (tier === "corporate" ? model.corporatePrice : model.price);

const tierPrices = (models: LinkModel[], tier: PriceTier) =>
  Object.fromEntries(models.map((model) => [model.id, priceInputValue(tierPrice(model, tier))]));

type Draft = {
  input: CommercialLinkFormInput;
  channel: WhatsAppChannel;
  lines: { name: string; price: number; custom: boolean }[];
  expiry: string;
  tierLabel: string;
};

/**
 * Novo link comercial: 1) tipo de evento e modelos/valores (começam no padrão do tipo;
 * editáveis só com permissão); 2) validade e identificação; 3) por último, o WhatsApp que
 * recebe os contatos (obrigatório, só os do usuário). Depois, revisão e geração. Valores e
 * destino não mudam depois.
 */
export function LinkForm({ channels, models, canCustomizePrices, siteOrigin, save, onCopy, onDone, onBusyChange }: Props) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [openedAt] = useState(() => Date.now());
  const [channelId, setChannelId] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>(() => Object.fromEntries(models.map((m) => [m.id, true])));
  const [tier, setTier] = useState<PriceTier>("private");
  const [prices, setPrices] = useState<Record<string, string>>(() => tierPrices(models, "private"));
  const [validity, setValidity] = useState<LinkValidity>("24h");
  const [custom, setCustom] = useState(() => agendaNow(new Date(openedAt + DAY_MS)));
  const [label, setLabel] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [created, setCreated] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => onBusyChange(pending), [pending, onBusyChange]);

  const field = (name: string) => `${id}-${name}`;

  if (created) {
    const url = sellerLinkUrl(siteOrigin, created.code);
    return (
      <div className={styles.form}>
        <p role="status" className={`${styles.alert} ${styles.alertSuccess}`}>
          {created.message}
        </p>
        <div className={styles.field}>
          <label htmlFor={field("url")} className={styles.label}>
            Link gerado
          </label>
          <input
            id={field("url")}
            readOnly
            value={url}
            className={`${styles.input} ${css.linkInput}`}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
        <div className={styles.dialogActions}>
          <ShareLinkButtons url={url} name="gerado" onCopy={() => onCopy(url)} />
          <button type="button" className={styles.button} onClick={() => onDone()}>
            Concluir
          </button>
        </div>
      </div>
    );
  }

  if (draft) {
    return (
      <div className={styles.form}>
        {error && (
          <p role="alert" className={`${styles.alert} ${styles.alertError}`}>
            {error}
          </p>
        )}
        <dl className={css.review} aria-label="Revisão da proposta">
          <div>
            <dt>Tipo de evento</dt>
            <dd>{draft.tierLabel}</dd>
          </div>
          <div>
            <dt>Formatos e valores</dt>
            <dd>
              <ul className={css.linkPrices}>
                {draft.lines.map((line) => (
                  <li key={line.name}>
                    <span>
                      {line.name}
                      {line.custom && <span className={css.tag}>personalizado</span>}
                    </span>
                    <span className={css.linkPrice}>{formatPrice(line.price)}</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          <div>
            <dt>Validade</dt>
            <dd>{draft.expiry}</dd>
          </div>
          {draft.input.label.trim() && (
            <div>
              <dt>Identificação (só no painel)</dt>
              <dd>{normalizeLinkLabel(draft.input.label)}</dd>
            </div>
          )}
          <div>
            <dt>WhatsApp que recebe os contatos</dt>
            <dd>
              {draft.channel.label} · {formatWhatsApp(draft.channel.whatsapp)}
            </dd>
          </div>
        </dl>
        <p className={styles.hint}>Depois de gerado, o link não pode ser editado: para mudar algo, crie outro link.</p>
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonGhost}`}
            disabled={pending}
            onClick={() => {
              setError(undefined);
              setDraft(null);
            }}
          >
            Voltar e editar
          </button>
          <button type="button" className={styles.button} disabled={pending} onClick={() => generate(draft.input)}>
            {pending ? "Gerando…" : "Gerar link"}
          </button>
        </div>
      </div>
    );
  }

  function generate(input: CommercialLinkFormInput) {
    startTransition(async () => {
      try {
        const result = await save(input);
        if (result.status === "success") setCreated({ code: result.code, message: result.message });
        else setError(result.message);
      } catch {
        setError(NETWORK_ERROR);
      }
    });
  }

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const chosen = models.filter((model) => selected[model.id]);
    if (chosen.length === 0) return setError("Escolha ao menos um modelo de show.");

    const invalid = canCustomizePrices ? chosen.filter((model) => parsePrice(prices[model.id]) === null) : [];
    if (invalid.length > 0) {
      return setError(`Informe um valor válido em reais, maior que zero, para: ${invalid.map((model) => model.name).join(", ")}.`);
    }

    try {
      normalizeLinkLabel(label);
    } catch (problem) {
      return setError(isAgendaError(problem) ? problem.message : "Dados inválidos.");
    }

    let expiry = LINK_VALIDITY_OPTIONS.find((option) => option.value === validity)!.label + " a partir de agora";
    if (validity === "custom") {
      const check = checkCustomExpiry(custom.date, custom.time, new Date());
      if (!check.ok) return setError(check.message);
      expiry = `Até ${formatTimestamp(check.expiresAt.toISOString())} (horário de Brasília)`;
    }

    // Último campo do formulário: conferido por último.
    const channel = channels.find((item) => item.id === channelId);
    if (!channel) return setError("Escolha o WhatsApp que vai receber os contatos deste link.");
    setError(undefined);

    const lines = chosen.map((model) => {
      const standard = tierPrice(model, tier);
      const price = canCustomizePrices ? parsePrice(prices[model.id])! : standard;
      return { model, price, custom: price !== standard };
    });
    setDraft({
      channel,
      expiry,
      tierLabel: TIER_OPTIONS.find((option) => option.value === tier)!.label,
      lines: lines.map(({ model, price, custom: isCustom }) => ({ name: model.name, price, custom: isCustom })),
      input: {
        channelId: channel.id,
        label,
        validity,
        date: custom.date,
        time: custom.time,
        tier,
        items: lines.map(({ model, price, custom: isCustom }) => (isCustom ? { modelId: model.id, price } : { modelId: model.id })),
      },
    });
  }

  const minDate = agendaNow(new Date(openedAt)).date;
  const limit = new Date(openedAt + LINK_MAX_MS);

  return (
    <form className={styles.form} onSubmit={handleReview} noValidate>
      {error && (
        <p role="alert" className={`${styles.alert} ${styles.alertError}`}>
          {error}
        </p>
      )}

      <fieldset className={css.fieldset}>
        <legend className={styles.label}>Tipo de evento</legend>
        <div className={css.validity}>
          {TIER_OPTIONS.map((option) => (
            <label key={option.value} className={css.validityOption}>
              <input
                type="radio"
                name="tier"
                value={option.value}
                checked={tier === option.value}
                onChange={() => {
                  setTier(option.value);
                  setPrices(tierPrices(models, option.value));
                }}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={css.fieldset}>
        <legend className={styles.label}>Formatos e valores *</legend>
        <ul className={css.options}>
          {models.map((model) => {
            const inputId = field(`price-${model.id}`);
            const value = prices[model.id] ?? "";
            const checked = selected[model.id] === true;
            return (
              <li key={model.id} className={canCustomizePrices ? css.modelRow : undefined}>
                <label className={css.option}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => setSelected((current) => ({ ...current, [model.id]: event.target.checked }))}
                  />
                  <span className={css.optionText}>
                    <strong>{model.name}</strong>
                    <span className={styles.hint}>Padrão: {formatPrice(tierPrice(model, tier))}</span>
                  </span>
                </label>
                {canCustomizePrices && (
                  <input
                    id={inputId}
                    aria-label={`Valor de ${model.name}`}
                    inputMode="decimal"
                    autoComplete="off"
                    disabled={!checked}
                    value={value}
                    aria-invalid={(checked && parsePrice(value) === null) || undefined}
                    onChange={(event) => setPrices((current) => ({ ...current, [model.id]: event.target.value }))}
                    className={`${styles.input} ${css.priceInput}`}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className={css.fieldset}>
        <legend className={styles.label}>Validade</legend>
        <div className={css.validity}>
          {LINK_VALIDITY_OPTIONS.map((option) => (
            <label key={option.value} className={css.validityOption}>
              <input
                type="radio"
                name="validity"
                value={option.value}
                checked={validity === option.value}
                onChange={() => setValidity(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
        {validity === "custom" ? (
          <>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor={field("date")} className={styles.label}>
                  Data de expiração
                </label>
                <input
                  id={field("date")}
                  type="date"
                  min={minDate}
                  max={agendaNow(limit).date}
                  value={custom.date}
                  onChange={(event) => setCustom((current) => ({ ...current, date: event.target.value }))}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor={field("time")} className={styles.label}>
                  Hora de expiração
                </label>
                <input
                  id={field("time")}
                  type="time"
                  value={custom.time}
                  onChange={(event) => setCustom((current) => ({ ...current, time: event.target.value }))}
                  className={styles.input}
                />
              </div>
            </div>
            <p className={styles.hint}>
              Horário de Brasília. No máximo 7 dias a partir da criação (até {formatTimestamp(limit.toISOString())}).
            </p>
          </>
        ) : (
          <p className={styles.hint}>O prazo começa a contar quando o link é gerado.</p>
        )}
      </fieldset>

      <div className={styles.field}>
        <label htmlFor={field("label")} className={styles.label}>
          Identificação (opcional)
        </label>
        <input
          id={field("label")}
          maxLength={LINK_LABEL_MAX}
          autoComplete="off"
          placeholder="Ex.: Casamento João"
          aria-describedby={field("label-hint")}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className={styles.input}
        />
      </div>

      <fieldset className={css.fieldset}>
        <legend className={styles.label}>WhatsApp que recebe os contatos *</legend>
        <div className={css.options} data-columns>
          {channels.map((channel) => (
            <label key={channel.id} className={css.option}>
              <input
                type="radio"
                name="channel"
                value={channel.id}
                checked={channelId === channel.id}
                onChange={() => setChannelId(channel.id)}
              />
              <span className={css.optionText}>
                <strong>
                  {channel.label}
                  {channel.is_primary && <span className={css.tag}>principal</span>}
                </strong>
                <span className={styles.hint}>{formatWhatsApp(channel.whatsapp)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.dialogActions}>
        <button type="button" className={`${styles.button} ${styles.buttonGhost}`} onClick={() => onDone()}>
          Cancelar
        </button>
        <button type="submit" className={styles.button}>
          Revisar proposta
        </button>
      </div>
    </form>
  );
}
