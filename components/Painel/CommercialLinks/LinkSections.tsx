"use client";

import { useId, useState, type ComponentProps } from "react";
import { agendaNow, currentMonthRange } from "@/lib/agenda/dates";
import {
  groupLinks,
  LINK_PERIOD_OPTIONS,
  linkPeriodRange,
  normalizeSearch,
  type LinkGroups,
  type LinkPeriod,
} from "@/lib/commercialLinks/linkGroups";
import type { CommercialLink } from "@/lib/commercialLinks/types";
import styles from "../Painel.module.css";
import css from "./CommercialLinks.module.css";
import { LinkHistory } from "./LinkHistory";

type HistoryProps = Omit<ComponentProps<typeof LinkHistory>, "label" | "emptyMessage" | "links">;

type Props = HistoryProps & {
  links: CommercialLink[];
  /** "Links gerados" (ADMIN) ou "Meus links" (SELLER). */
  title: string;
};

const SECTIONS: { key: keyof LinkGroups; title: string; noun: string }[] = [
  { key: "active", title: "Links ativos", noun: "link ativo" },
  { key: "expired", title: "Links expirados", noun: "link expirado" },
  { key: "revoked", title: "Links desativados", noun: "link desativado" },
];

/**
 * Histórico em três seções (ativos, expirados e desativados), cada uma retrátil, filtrado
 * pela data de criação. Padrão: links gerados no mês atual (calendário de Brasília).
 */
export function LinkSections({ links, title, ...history }: Props) {
  const id = useId();
  const [period, setPeriod] = useState<LinkPeriod>("month");
  const [custom, setCustom] = useState(() => ({ ...currentMonthRange(), to: agendaNow().date }));
  const [search, setSearch] = useState("");
  // Padrão: só os ativos abertos; expirados e desativados começam retraídos.
  const [collapsed, setCollapsed] = useState<ReadonlySet<keyof LinkGroups>>(() => new Set(["expired", "revoked"]));

  // Com busca, procura em todos os períodos: o objetivo é achar o link, onde quer que esteja.
  const searching = normalizeSearch(search) !== "";
  const range = linkPeriodRange(period, new Date(), custom);
  const invalidPeriod = !searching && !range;
  const grouped = groupLinks(links, searching ? null : range, search);
  // Período inválido: avisa e não mostra nenhum link até corrigir as datas.
  const groups: LinkGroups = invalidPeriod ? { active: [], expired: [], revoked: [] } : grouped;

  const toggle = (key: keyof LinkGroups) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className={css.section} aria-labelledby={`${id}-title`}>
      <div className={css.historyHead}>
        <h2 id={`${id}-title`} className={css.sectionTitle}>
          {title}
        </h2>
        <div className={css.period}>
          <label className={css.search}>
            <SearchIcon />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                // Ao começar uma busca, abre as três seções para mostrar todos os resultados.
                if (!searching && normalizeSearch(event.target.value) !== "") setCollapsed(new Set());
                setSearch(event.target.value);
              }}
              placeholder="Buscar pelo nome do evento"
              aria-label="Buscar pelo nome do evento"
              className={`${styles.input} ${css.searchInput}`}
            />
          </label>
          <div className={css.periodField}>
            <label htmlFor={`${id}-period`} className={styles.label}>
              Período
            </label>
            <select
              id={`${id}-period`}
              value={period}
              onChange={(event) => setPeriod(event.target.value as LinkPeriod)}
              disabled={searching}
              className={styles.input}
            >
              {LINK_PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {period === "custom" && !searching && (
            <>
              <label className={css.periodDate}>
                <span className={styles.hint}>De</span>
                <input
                  type="date"
                  value={custom.from}
                  max={custom.to || undefined}
                  onChange={(event) => setCustom((current) => ({ ...current, from: event.target.value }))}
                  className={styles.input}
                  aria-label="Data inicial"
                />
              </label>
              <label className={css.periodDate}>
                <span className={styles.hint}>Até</span>
                <input
                  type="date"
                  value={custom.to}
                  min={custom.from || undefined}
                  onChange={(event) => setCustom((current) => ({ ...current, to: event.target.value }))}
                  className={styles.input}
                  aria-label="Data final"
                />
              </label>
            </>
          )}
        </div>
      </div>
      <p className={css.meta}>
        {searching ? "Buscando em todos os períodos pelo nome do evento." : "Pela data em que o link foi gerado."}
      </p>

      {invalidPeriod && (
        <p role="alert" className={`${styles.alert} ${styles.alertError}`}>
          Informe um período válido: a data inicial não pode ser depois da final.
        </p>
      )}
      {SECTIONS.map((section) => {
          const items = groups[section.key];
          const open = !collapsed.has(section.key);
          const bodyId = `${id}-${section.key}`;
          return (
            <div key={section.key} className={css.group} data-group={section.key}>
              <button
                type="button"
                className={css.groupHeader}
                aria-expanded={open}
                aria-controls={bodyId}
                onClick={() => toggle(section.key)}
              >
                <span className={css.groupTitle}>
                  {section.title} <span className={css.groupCount}>({items.length})</span>
                </span>
                <span className={css.chevron} aria-hidden="true" />
              </button>
              {open && (
                <div id={bodyId}>
                  <LinkHistory {...history} label={section.title} emptyMessage={
                      searching
                        ? `Nenhum ${section.noun} com esse nome.`
                        : `Nenhum ${section.noun} gerado neste período.`
                    } links={items} />
                </div>
              )}
            </div>
          );
        })}
    </section>
  );
}

function SearchIcon() {
  return (
    <svg className={css.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
