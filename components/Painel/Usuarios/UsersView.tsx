"use client";

import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  changeUserRoleAction,
  deactivateUserAction,
  inviteUserAction,
  reactivateUserAction,
  renameUserAction,
} from "@/app/painel/(area)/usuarios/actions";
import type { Role } from "@/lib/agenda/types";
import type { TeamMember } from "@/lib/agenda/usersAdmin";
import { ROLE_LABELS } from "@/lib/painel/access";
import { formatTimestamp } from "@/lib/painel/showFormat";
import type { UserActionResult } from "@/lib/painel/users";
import agenda from "../Agenda/Agenda.module.css";
import { Dialog } from "../Dialog";
import styles from "../Painel.module.css";
import { useToast } from "../Toast";
import users from "./Users.module.css";

/**
 * Gestão de usuários (a página só chega aqui para ADMIN). Esconder botões, como os de
 * rebaixar/desativar a si mesmo, é só conveniência: o servidor e o banco recusam.
 */

const FILTERS = {
  todos: { label: "Todos", match: () => true },
  ativos: { label: "Ativos", match: (m: TeamMember) => m.active },
  inativos: { label: "Inativos", match: (m: TeamMember) => !m.active },
  admin: { label: "ADMIN", match: (m: TeamMember) => m.role === "ADMIN" },
  editor: { label: "EDITOR", match: (m: TeamMember) => m.role === "EDITOR" },
} satisfies Record<string, { label: string; match: (member: TeamMember) => boolean }>;

type Filter = keyof typeof FILTERS;

type Pending =
  | { kind: "invite" }
  | { kind: "rename"; member: TeamMember }
  | { kind: "role"; member: TeamMember; role: Role }
  | { kind: "deactivate"; member: TeamMember }
  | { kind: "reactivate"; member: TeamMember };

const NETWORK_ERROR = "Não foi possível realizar a operação. Verifique a conexão e tente novamente.";
const otherRole = (role: Role): Role => (role === "ADMIN" ? "EDITOR" : "ADMIN");
const formatDate = (value: string) => formatTimestamp(value).slice(0, 10);

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function UsersView({ members, currentUserId }: { members: TeamMember[]; currentUserId: string }) {
  const toast = useToast();
  const [busy, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [dialog, setDialog] = useState<Pending | null>(null);
  const [formError, setFormError] = useState<string>();

  const names = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const nameOf = (id: string | null) => (id ? (names.get(id) ?? "usuário removido") : null);

  const visible = useMemo(() => {
    const term = normalize(search.trim());
    return members.filter(
      (m) => FILTERS[filter].match(m) && (!term || normalize(`${m.name} ${m.email ?? ""}`).includes(term)),
    );
  }, [members, filter, search]);

  function open(next: Pending) {
    setFormError(undefined);
    setDialog(next);
  }

  function close() {
    if (!busy) setDialog(null);
  }

  /** Uma operação por vez; em caso de erro no formulário, o modal continua aberto. */
  function perform(action: () => Promise<UserActionResult>, { keepOpenOnError = false } = {}) {
    if (busy) return;
    startTransition(async () => {
      let result: UserActionResult;
      try {
        result = await action();
      } catch {
        result = { status: "error", message: NETWORK_ERROR };
      }
      if (result.status === "success") {
        toast(result.message);
        setDialog(null);
      } else if (keepOpenOnError) {
        setFormError(result.message);
      } else {
        setDialog(null);
        toast(result.message, "error");
      }
    });
  }

  function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    perform(
      () =>
        inviteUserAction({
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          role: String(data.get("role") ?? ""),
        }),
      { keepOpenOnError: true },
    );
  }

  function submitRename(event: FormEvent<HTMLFormElement>, member: TeamMember) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    perform(() => renameUserAction(member.id, name), { keepOpenOnError: true });
  }

  return (
    <>
      <div className={agenda.toolbar}>
        <input
          type="search"
          className={`${styles.input} ${agenda.search}`}
          placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar usuários"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="button" className={styles.button} onClick={() => open({ kind: "invite" })}>
          + Novo usuário
        </button>
      </div>

      <div className={agenda.months} role="group" aria-label="Filtrar usuários">
        {(Object.keys(FILTERS) as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            className={agenda.chip}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {FILTERS[key].label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className={agenda.empty}>
          <p>Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <ul className={agenda.list} aria-label="Usuários">
          {visible.map((member) => {
            const isMe = member.id === currentUserId;
            const invitedBy = nameOf(member.createdBy);
            return (
              <li key={member.id} className={users.row} data-inactive={!member.active || undefined}>
                <div className={users.identity}>
                  <p className={users.name}>
                    {member.name}
                    {isMe && <span className={agenda.badge}>Você</span>}
                  </p>
                  {member.email && <p className={users.email}>{member.email}</p>}
                  <p className={agenda.meta}>
                    {invitedBy
                      ? `Convidado por ${invitedBy} em ${formatDate(member.createdAt)}`
                      : `Desde ${formatDate(member.createdAt)}`}
                    {member.lastSignInAt && ` · Último acesso em ${formatTimestamp(member.lastSignInAt)}`}
                  </p>
                  {!member.active && member.deactivatedAt && (
                    <p className={agenda.meta}>
                      Desativado em {formatTimestamp(member.deactivatedAt)}
                      {nameOf(member.deactivatedBy) && ` por ${nameOf(member.deactivatedBy)}`}
                    </p>
                  )}
                </div>

                <div className={users.status}>
                  <span className={users.role}>{ROLE_LABELS[member.role]}</span>
                  <span className={users.state} data-state={member.active ? "active" : "inactive"}>
                    {member.active ? "Ativo" : "Inativo"}
                  </span>
                  {member.active && member.invitePending && <span className={agenda.badge}>Convite pendente</span>}
                </div>

                <div className={`${agenda.actions} ${users.actions}`}>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonGhost} ${agenda.action}`}
                    aria-label={`Editar nome de ${member.name}`}
                    disabled={busy}
                    onClick={() => open({ kind: "rename", member })}
                  >
                    Editar
                  </button>
                  {!isMe && member.active && (
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonGhost} ${agenda.action}`}
                      aria-label={`Tornar ${member.name} ${ROLE_LABELS[otherRole(member.role)]}`}
                      disabled={busy}
                      onClick={() => open({ kind: "role", member, role: otherRole(member.role) })}
                    >
                      Tornar {ROLE_LABELS[otherRole(member.role)]}
                    </button>
                  )}
                  {!isMe &&
                    (member.active ? (
                      <button
                        type="button"
                        className={`${styles.button} ${styles.buttonGhost} ${agenda.action} ${agenda.danger}`}
                        aria-label={`Desativar ${member.name}`}
                        disabled={busy}
                        onClick={() => open({ kind: "deactivate", member })}
                      >
                        Desativar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`${styles.button} ${styles.buttonGhost} ${agenda.action}`}
                        aria-label={`Reativar ${member.name}`}
                        disabled={busy}
                        onClick={() => open({ kind: "reactivate", member })}
                      >
                        Reativar
                      </button>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={dialog?.kind === "invite"} title="Novo usuário" busy={busy} onClose={close}>
        <form className={styles.form} onSubmit={submitInvite} noValidate>
          {formError && (
            <p role="alert" className={`${styles.alert} ${styles.alertError}`}>
              {formError}
            </p>
          )}
          <div className={styles.field}>
            <label htmlFor="invite-name" className={styles.label}>
              Nome *
            </label>
            <input id="invite-name" name="name" required maxLength={120} autoComplete="off" className={styles.input} />
          </div>
          <div className={styles.field}>
            <label htmlFor="invite-email" className={styles.label}>
              E-mail *
            </label>
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="invite-role" className={styles.label}>
              Perfil *
            </label>
            <select id="invite-role" name="role" defaultValue="EDITOR" className={styles.input}>
              <option value="EDITOR">{ROLE_LABELS.EDITOR}</option>
              <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
            </select>
          </div>
          <p className={styles.hint}>
            O usuário recebe um e-mail do Supabase para definir a própria senha. Ninguém mais vê ou define essa senha.
          </p>
          <div className={styles.dialogActions}>
            <button type="button" className={`${styles.button} ${styles.buttonGhost}`} disabled={busy} onClick={close}>
              Cancelar
            </button>
            <button type="submit" className={styles.button} disabled={busy}>
              {busy ? "Enviando convite…" : "Enviar convite"}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog open={dialog?.kind === "rename"} title="Editar usuário" busy={busy} onClose={close}>
        {dialog?.kind === "rename" && (
          <form className={styles.form} onSubmit={(event) => submitRename(event, dialog.member)} noValidate>
            {formError && (
              <p role="alert" className={`${styles.alert} ${styles.alertError}`}>
                {formError}
              </p>
            )}
            <div className={styles.field}>
              <label htmlFor="rename-name" className={styles.label}>
                Nome *
              </label>
              <input
                id="rename-name"
                name="name"
                required
                maxLength={120}
                defaultValue={dialog.member.name}
                autoComplete="off"
                className={styles.input}
              />
            </div>
            {dialog.member.email && <p className={styles.hint}>E-mail: {dialog.member.email} (não editável)</p>}
            <div className={styles.dialogActions}>
              <button type="button" className={`${styles.button} ${styles.buttonGhost}`} disabled={busy} onClick={close}>
                Cancelar
              </button>
              <button type="submit" className={styles.button} disabled={busy}>
                {busy ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog open={dialog?.kind === "role"} title="Alterar perfil?" busy={busy} onClose={close}>
        {dialog?.kind === "role" && (
          <Confirm
            busy={busy}
            label="Confirmar"
            busyLabel="Salvando…"
            onCancel={close}
            onConfirm={() => perform(() => changeUserRoleAction(dialog.member.id, dialog.role))}
          >
            <strong>{dialog.member.name}</strong>
            <span>
              {ROLE_LABELS[dialog.member.role]} → {ROLE_LABELS[dialog.role]}
            </span>
          </Confirm>
        )}
      </Dialog>

      <Dialog open={dialog?.kind === "deactivate"} title="Desativar usuário?" busy={busy} onClose={close}>
        {dialog?.kind === "deactivate" && (
          <Confirm
            busy={busy}
            danger
            label="Desativar"
            busyLabel="Desativando…"
            note="Esse usuário perderá acesso ao painel imediatamente, mesmo se estiver conectado. O histórico dele é preservado."
            onCancel={close}
            onConfirm={() => perform(() => deactivateUserAction(dialog.member.id))}
          >
            <strong>{dialog.member.name}</strong>
            <span>{ROLE_LABELS[dialog.member.role]}</span>
          </Confirm>
        )}
      </Dialog>

      <Dialog open={dialog?.kind === "reactivate"} title="Reativar usuário?" busy={busy} onClose={close}>
        {dialog?.kind === "reactivate" && (
          <Confirm
            busy={busy}
            label="Reativar"
            busyLabel="Reativando…"
            note={`Esse usuário voltará a acessar o painel como ${ROLE_LABELS[dialog.member.role]}.`}
            onCancel={close}
            onConfirm={() => perform(() => reactivateUserAction(dialog.member.id))}
          >
            <strong>{dialog.member.name}</strong>
            <span>{ROLE_LABELS[dialog.member.role]}</span>
          </Confirm>
        )}
      </Dialog>
    </>
  );
}

function Confirm({
  children,
  note,
  label,
  busyLabel,
  danger = false,
  busy,
  onCancel,
  onConfirm,
}: {
  children: ReactNode;
  note?: string;
  label: string;
  busyLabel: string;
  danger?: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <p className={agenda.confirmShow}>{children}</p>
      {note && <p className={styles.hint}>{note}</p>}
      <div className={styles.dialogActions}>
        <button type="button" className={`${styles.button} ${styles.buttonGhost}`} disabled={busy} onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className={`${styles.button} ${danger ? styles.buttonDanger : ""}`}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? busyLabel : label}
        </button>
      </div>
    </>
  );
}
