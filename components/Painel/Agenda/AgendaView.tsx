"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createShowAction,
  deleteShowAction,
  restoreShowAction,
  updateShowAction,
} from "@/app/painel/(area)/agenda/actions";
import { instagramProfileUrl } from "@/lib/agenda/instagram";
import type { Show, ShowInput } from "@/lib/agenda/types";
import type { AgendaFilter, ShowActionResult } from "@/lib/painel/agenda";
import {
  formatShowDate,
  formatShowTime,
  formatTimestamp,
  isPastShow,
  monthKey,
  monthLabel,
  showDateParts,
} from "@/lib/painel/showFormat";
import { Dialog } from "../Dialog";
import styles from "../Painel.module.css";
import { useToast } from "../Toast";
import agenda from "./Agenda.module.css";
import { ShowForm } from "./ShowForm";

type Props = {
  shows: Show[];
  filter: AgendaFilter;
  /** Nomes da equipe por id, para exibir a auditoria. */
  authors: Record<string, string>;
  /** "Agora" no fuso da banda, calculado no servidor (evita divergência de hidratação). */
  now: { date: string; time: string };
};

const NETWORK_ERROR = "Não foi possível concluir a operação. Verifique a conexão e tente novamente.";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function AgendaView({ shows, filter, authors, now }: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState<string | null>(null);
  const [editing, setEditing] = useState<Show | "new" | null>(null);
  const [deleting, setDeleting] = useState<Show | null>(null);
  const [formError, setFormError] = useState<string>();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const isTrash = filter === "excluidos";
  const months = useMemo(() => [...new Set(shows.map((show) => monthKey(show.show_date)))], [shows]);
  const activeMonth = month && months.includes(month) ? month : null;

  const visible = useMemo(() => {
    const term = normalize(search.trim().replace(/^@/, ""));
    return shows.filter(
      (show) =>
        (!activeMonth || monthKey(show.show_date) === activeMonth) &&
        (!term || normalize(`${show.venue_name} ${show.venue_instagram ?? ""}`).includes(term)),
    );
  }, [shows, search, activeMonth]);

  /** Lixeira em ordem de exclusão; demais filtros agrupados por mês. */
  const groups = useMemo(() => {
    if (isTrash) return [{ key: "trash", label: null as string | null, items: visible }];
    const byMonth = new Map<string, Show[]>();
    for (const show of visible) {
      const key = monthKey(show.show_date);
      byMonth.set(key, [...(byMonth.get(key) ?? []), show]);
    }
    return [...byMonth].map(([key, items]) => ({ key, label: monthLabel(key), items }));
  }, [visible, isTrash]);

  const author = (id: string | null) => (id ? (authors[id] ?? "usuário removido") : "—");

  /** Executa uma Server Action sem permitir envios paralelos; a lista volta revalidada. */
  function perform(action: () => Promise<ShowActionResult>, onSuccess: () => void, onError: (message: string) => void) {
    if (pending) return;
    startTransition(async () => {
      let result: ShowActionResult;
      try {
        result = await action();
      } catch {
        result = { status: "error", message: NETWORK_ERROR };
      }
      if (result.status === "success") {
        toast(result.message);
        onSuccess();
      } else {
        onError(result.message);
      }
    });
  }

  function openForm(target: Show | "new") {
    setFormError(undefined);
    setEditing(target);
  }

  function saveShow(input: ShowInput) {
    const target = editing;
    if (!target) return;
    perform(
      () => (target === "new" ? createShowAction(input) : updateShowAction(target.id, input)),
      () => setEditing(null),
      setFormError,
    );
  }

  function confirmDelete() {
    const target = deleting;
    if (!target) return;
    perform(
      () => deleteShowAction(target.id),
      () => setDeleting(null),
      (message) => {
        setDeleting(null);
        toast(message, "error");
      },
    );
  }

  function restore(show: Show) {
    setRestoringId(show.id);
    perform(
      () => restoreShowAction(show.id),
      () => setRestoringId(null),
      (message) => {
        setRestoringId(null);
        toast(message, "error");
      },
    );
  }

  return (
    <>
      <div className={agenda.toolbar}>
        <input
          type="search"
          className={`${styles.input} ${agenda.search}`}
          placeholder="Buscar por local ou Instagram"
          aria-label="Buscar shows"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="button" className={styles.button} onClick={() => openForm("new")}>
          + Novo show
        </button>
      </div>

      {!isTrash && months.length > 1 && (
        <div className={agenda.months} role="group" aria-label="Filtrar por mês">
          <button
            type="button"
            className={agenda.chip}
            aria-pressed={activeMonth === null}
            onClick={() => setMonth(null)}
          >
            Todos os meses
          </button>
          {months.map((key) => (
            <button
              key={key}
              type="button"
              className={agenda.chip}
              aria-pressed={activeMonth === key}
              onClick={() => setMonth(key)}
            >
              {monthLabel(key)}
            </button>
          ))}
        </div>
      )}

      {shows.length === 0 ? (
        <div className={agenda.empty}>
          <p>{isTrash ? "Nenhum show excluído." : "Nenhum show encontrado."}</p>
          {!isTrash && (
            <button type="button" className={styles.button} onClick={() => openForm("new")}>
              + Adicionar show
            </button>
          )}
        </div>
      ) : visible.length === 0 ? (
        <div className={agenda.empty}>
          <p>Nenhum show encontrado para essa busca.</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className={agenda.group} aria-label={group.label ?? "Shows excluídos"}>
            {group.label && <h2 className={agenda.groupTitle}>{group.label}</h2>}
            <ul className={agenda.list}>
              {group.items.map((show) => {
                const date = showDateParts(show.show_date);
                const past = !isTrash && isPastShow(show, now);
                const label = `${formatShowDate(show.show_date)} em ${show.venue_name}`;
                return (
                  <li key={show.id} className={agenda.row} data-past={past || undefined}>
                    <p className={agenda.date}>
                      <span className={agenda.day}>{date.day}</span>
                      <span className={agenda.month}>{date.month}</span>
                      <span className={agenda.weekday}>{isTrash ? date.year : date.weekday}</span>
                    </p>
                    <p className={agenda.time}>{formatShowTime(show.show_time)}</p>
                    <div className={agenda.venue}>
                      <p className={agenda.venueName}>
                        {show.venue_name}
                        {past && <span className={agenda.badge}>Realizado</span>}
                      </p>
                      {show.venue_instagram && (
                        <a
                          className={agenda.instagram}
                          href={instagramProfileUrl(show.venue_instagram)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          @{show.venue_instagram}
                        </a>
                      )}
                      {isTrash && show.deleted_at && (
                        <p className={agenda.meta}>
                          Excluído em {formatTimestamp(show.deleted_at)} por {author(show.deleted_by)}
                        </p>
                      )}
                    </div>
                    <div className={agenda.actions}>
                      {isTrash ? (
                        <button
                          type="button"
                          className={`${styles.button} ${styles.buttonGhost} ${agenda.action}`}
                          aria-label={`Restaurar show de ${label}`}
                          disabled={pending}
                          onClick={() => restore(show)}
                        >
                          {restoringId === show.id ? "Restaurando…" : "Restaurar"}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={`${styles.button} ${styles.buttonGhost} ${agenda.action}`}
                            aria-label={`Editar show de ${label}`}
                            disabled={pending}
                            onClick={() => openForm(show)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={`${styles.button} ${styles.buttonGhost} ${agenda.action} ${agenda.danger}`}
                            aria-label={`Excluir show de ${label}`}
                            disabled={pending}
                            onClick={() => setDeleting(show)}
                          >
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <Dialog
        open={editing !== null}
        title={editing === "new" ? "Novo show" : "Editar show"}
        busy={pending}
        onClose={() => setEditing(null)}
      >
        {editing && editing !== "new" && (
          <p className={`${styles.hint} ${agenda.audit}`}>
            Criado por {author(editing.created_by)} em {formatTimestamp(editing.created_at)}
            {editing.updated_at !== editing.created_at &&
              ` · Última alteração por ${author(editing.updated_by)} em ${formatTimestamp(editing.updated_at)}`}
          </p>
        )}
        <ShowForm
          show={editing && editing !== "new" ? editing : undefined}
          pending={pending}
          error={formError}
          onSubmit={saveShow}
          onCancel={() => setEditing(null)}
        />
      </Dialog>

      <Dialog open={deleting !== null} title="Excluir show?" busy={pending} onClose={() => setDeleting(null)}>
        {deleting && (
          <>
            <p className={agenda.confirmShow}>
              <strong>{formatShowDate(deleting.show_date)}</strong>
              <span>{formatShowTime(deleting.show_time)}</span>
              <span>{deleting.venue_name}</span>
            </p>
            <p className={styles.hint}>
              Esse show será removido da agenda ativa, mas permanecerá no histórico e poderá ser restaurado em
              “Excluídos”.
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonGhost}`}
                disabled={pending}
                onClick={() => setDeleting(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonDanger}`}
                disabled={pending}
                onClick={confirmDelete}
              >
                {pending ? "Excluindo…" : "Excluir show"}
              </button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
