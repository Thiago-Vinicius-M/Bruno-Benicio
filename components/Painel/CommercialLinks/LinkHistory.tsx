"use client";

import { useState } from "react";
import type { CommercialLink, CommercialLinkStatus } from "@/lib/commercialLinks/types";
import { formatTimestamp } from "@/lib/painel/showFormat";
import { sellerLinkUrl } from "@/lib/sellers/sellerLink";
import { formatPrice } from "@/lib/showModels/price";
import { formatWhatsApp } from "@/lib/whatsapp";
import agenda from "../Agenda/Agenda.module.css";
import styles from "../Painel.module.css";
import css from "./CommercialLinks.module.css";
import { ShareLinkButtons } from "./ShareLinkButtons";

type Props = {
  /** Nome da lista para leitores de tela ("Links ativos"). */
  label: string;
  /** Texto quando a lista está vazia. */
  emptyMessage: string;
  /** Mais recentes primeiro. */
  links: CommercialLink[];
  siteOrigin: string;
  /** ADMIN vê de quem é cada link. */
  showAuthor: boolean;
  busyId: string | null;
  pending: boolean;
  onCopy: (url: string, name: string) => void;
  onDeactivate: (link: CommercialLink) => void;
};

const STATUS_LABEL: Record<CommercialLinkStatus, string> = {
  active: "Ativo",
  expired: "Expirado",
  revoked: "Desativado",
  inactive: "Sem WhatsApp",
};

/** "Casamento João" ou, sem identificação, a data de criação. */
export const commercialLinkName = (link: CommercialLink) => link.label ?? `Link de ${formatTimestamp(link.created_at)}`;

/** De onde vêm os contatos: o canal gravado no link (ou o vendedor antigo) e o destino atual. */
function destinationText(link: CommercialLink): string {
  const origin = `WhatsApp: ${link.channel_label} · ${formatWhatsApp(link.whatsapp)}`;
  if (link.status !== "active" && link.status !== "inactive") return origin;
  if (!link.destination) return `${origin} · desativado, sem redirecionamento`;
  if (link.destination !== link.whatsapp) return `${origin} · contatos redirecionados para ${formatWhatsApp(link.destination)}`;
  return origin;
}

/** Validade na linha compacta: o prazo, ou o que aconteceu com o link. */
function compactValidity(link: CommercialLink): string {
  if (link.status === "revoked") return `Desativado em ${formatTimestamp(link.deactivated_at ?? link.expires_at)}`;
  if (link.status === "expired") return `Expirou em ${formatTimestamp(link.expires_at)}`;
  if (link.status === "inactive") return `Sem WhatsApp · até ${formatTimestamp(link.expires_at)}`;
  return `Válido até ${formatTimestamp(link.expires_at)}`;
}

/** "17/10/2026 12:00" → "17/10/2026". */
const formatDay = (iso: string) => formatTimestamp(iso).slice(0, 10);

/**
 * Histórico de links (ativos, expirados, desativados e sem WhatsApp), lido do banco:
 * status pelo relógio do banco, valores e destino gravados no link. Nada é apagado; só um
 * link ativo pode ser copiado ou desativado. Cada link aparece numa linha (data, evento,
 * validade e endereço, junto dos botões de compartilhar); a seta abre o cartão completo.
 */
export function LinkHistory({ label, emptyMessage, links, siteOrigin, showAuthor, busyId, pending, onCopy, onDeactivate }: Props) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (links.length === 0) {
    return <p className={css.meta}>{emptyMessage}</p>;
  }

  return (
    <ul className={css.links} aria-label={label}>
      {links.map((link) => {
        const name = commercialLinkName(link);
        const url = sellerLinkUrl(siteOrigin, link.code);
        const isActive = link.status === "active";
        const author = link.created_by ? (link.created_by_name ?? "usuário removido") : "SQL Editor";
        const open = expanded.has(link.id);
        const copy = () => onCopy(url, link.label ? `“${link.label}”` : "comercial");
        const detailsId = `link-detalhes-${link.id}`;
        const toggleButton = (
          <button
            type="button"
            className={css.toggle}
            aria-expanded={open}
            aria-controls={detailsId}
            aria-label={`${open ? "Ocultar" : "Ver"} detalhes do link ${name}`}
            onClick={() => toggle(link.id)}
          >
            <span className={css.chevron} aria-hidden="true" />
          </button>
        );

        if (!open) {
          return (
            <li
              key={link.id}
              id={detailsId}
              className={`${css.linkCard} ${css.compact}`}
              data-status={link.status}
              aria-busy={busyId === link.id || undefined}
            >
              <span className={css.compactDate}>{formatDay(link.created_at)}</span>
              <span className={css.compactName}>{link.label ?? ""}</span>
              <span className={css.compactValidity}>{compactValidity(link)}</span>
              <span className={css.compactUrl} title={url}>
                <span className={css.urlHost}>{new URL(url).host}</span>
                {new URL(url).pathname}
              </span>
              <span className={css.compactActions}>
                <ShareLinkButtons variant="icon" url={url} name={name} disabled={!isActive} onCopy={copy} />
              </span>
              {toggleButton}
            </li>
          );
        }

        return (
          <li
            key={link.id}
            id={detailsId}
            className={css.linkCard}
            data-status={link.status}
            aria-busy={busyId === link.id || undefined}
          >
            <div className={css.linkHead}>
              <p className={css.linkName}>
                {name}
                <span className={css.pill} data-status={link.status}>
                  {STATUS_LABEL[link.status]}
                </span>
                {toggleButton}
              </p>
              <p className={css.meta}>
                Criado em {formatTimestamp(link.created_at)}
                {showAuthor && ` por ${author}`} ·{" "}
                {link.status === "revoked" && link.deactivated_at
                  ? `Desativado em ${formatTimestamp(link.deactivated_at)} (valia até ${formatTimestamp(link.expires_at)})`
                  : `${link.status === "expired" ? "Expirou" : "Expira"} em ${formatTimestamp(link.expires_at)}`}
              </p>
              <p className={css.meta}>{destinationText(link)}</p>
            </div>

            <div className={css.linkRow}>
              <input
                readOnly
                value={url}
                aria-label={`Endereço do link ${name}`}
                className={`${styles.input} ${css.linkInput}`}
                onFocus={(event) => event.currentTarget.select()}
              />
              <ShareLinkButtons url={url} name={name} disabled={!isActive} onCopy={copy} />
              {(link.status === "active" || link.status === "inactive") && (
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonGhost} ${agenda.action} ${agenda.danger}`}
                  aria-label={`Desativar link ${name}`}
                  disabled={pending}
                  onClick={() => onDeactivate(link)}
                >
                  Desativar
                </button>
              )}
            </div>

            <ul className={css.linkPrices} aria-label={`Valores do link ${name}`}>
              {link.prices.map((price) => (
                <li key={price.model_id}>
                  <span>{price.name}</span>
                  <span className={css.linkPrice}>{formatPrice(price.price)}</span>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
