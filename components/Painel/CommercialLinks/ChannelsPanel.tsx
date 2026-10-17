"use client";

import { useCallback, useState } from "react";
import {
  activateChannelAction,
  createChannelAction,
  deactivateChannelAction,
  updateChannelAction,
} from "@/app/painel/(area)/links/actions";
import type { ChannelOwner, WhatsAppChannel } from "@/lib/commercialLinks/types";
import type { ActionResult } from "@/lib/painel/actionResult";
import { formatWhatsApp } from "@/lib/whatsapp";
import agenda from "../Agenda/Agenda.module.css";
import { Dialog } from "../Dialog";
import styles from "../Painel.module.css";
import { useToast } from "../Toast";
import { ChannelForm, type ChannelFormInput } from "./ChannelForm";
import css from "./CommercialLinks.module.css";

type Props = {
  channels: WhatsAppChannel[];
  owners: ChannelOwner[];
  busyId: string | null;
  pending: boolean;
  perform: (id: string, action: () => Promise<ActionResult>, onSuccess?: () => void) => void;
};

/**
 * WhatsApp autorizados de cada usuário (só ADMIN). Cada usuário escolhe entre os próprios
 * ao criar um link. Desativar não apaga: os links já criados com o canal podem ser
 * redirecionados para outro número ativo; sem isso, deixam de abrir conversa.
 */
export function ChannelsPanel({ channels, owners, busyId, pending, perform }: Props) {
  const toast = useToast();
  const [editing, setEditing] = useState<WhatsAppChannel | "new" | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [deactivating, setDeactivating] = useState<WhatsAppChannel | null>(null);
  const [redirectTo, setRedirectTo] = useState("");

  const ownerNames = new Map(owners.map((owner) => [owner.id, owner.name]));
  const ownerName = (id: string) => ownerNames.get(id) ?? "Usuário desativado";
  // Usuários ativos (mesmo sem canal) e donos de canais que já não estão na lista.
  const ownerIds = [...new Set([...owners.map((owner) => owner.id), ...channels.map((channel) => channel.owner_id)])];
  const labelOf = (id: string | null) => {
    const target = channels.find((channel) => channel.id === id);
    return target ? `${target.label} · ${formatWhatsApp(target.whatsapp)} (${ownerName(target.owner_id)})` : "outro WhatsApp";
  };

  const save = useCallback(
    (input: ChannelFormInput) => {
      const target = editing;
      if (!target) return Promise.resolve<ActionResult>({ status: "error", message: "WhatsApp inválido." });
      return target === "new"
        ? createChannelAction(input)
        : updateChannelAction(target.id, { label: input.label, isPrimary: input.isPrimary });
    },
    [editing],
  );

  const onSaved = useCallback(
    (message: string) => {
      setEditing(null);
      toast(message);
    },
    [toast],
  );

  const redirectOptions = deactivating
    ? channels.filter((channel) => channel.active && channel.id !== deactivating.id)
    : [];

  return (
    <section className={css.section} aria-labelledby="canais-whatsapp">
      <h2 id="canais-whatsapp" className={css.sectionTitle}>
        WhatsApp dos usuários
      </h2>
      <p className={styles.hint}>
        Só administradores cadastram números. Cada usuário escolhe, ao criar um link, um dos próprios WhatsApp ativos.
      </p>
      <div className={agenda.toolbar}>
        <button type="button" className={styles.button} onClick={() => setEditing("new")}>
          + Novo WhatsApp
        </button>
      </div>

      {ownerIds.length === 0 ? (
        <div className={agenda.empty}>
          <p>Nenhum usuário Administrador ou Vendedor ativo.</p>
        </div>
      ) : (
        <ul className={agenda.list} aria-label="WhatsApp por usuário">
          {ownerIds.map((ownerId) => {
            const own = channels.filter((channel) => channel.owner_id === ownerId);
            return (
              <li key={ownerId} className={css.owner}>
                <p className={css.ownerName}>{ownerName(ownerId)}</p>
                {own.length === 0 ? (
                  <p className={css.meta}>Nenhum WhatsApp cadastrado: este usuário ainda não consegue criar links.</p>
                ) : (
                  <ul className={css.channels} aria-label={`WhatsApp de ${ownerName(ownerId)}`}>
                    {own.map((channel) => (
                      <li
                        key={channel.id}
                        className={css.channel}
                        data-inactive={!channel.active || undefined}
                        aria-busy={busyId === channel.id || undefined}
                      >
                        <div className={css.channelInfo}>
                          <p className={css.channelLabel}>
                            {channel.label}
                            {channel.is_primary && (
                              <span className={css.pill} data-status="primary">
                                Principal
                              </span>
                            )}
                            {!channel.active && (
                              <span className={css.pill} data-status="inactive">
                                Desativado
                              </span>
                            )}
                          </p>
                          <p className={css.meta}>
                            {formatWhatsApp(channel.whatsapp)}
                            {!channel.active &&
                              (channel.redirect_channel_id
                                ? ` · links redirecionados para ${labelOf(channel.redirect_channel_id)}`
                                : " · links sem WhatsApp")}
                          </p>
                        </div>
                        <div className={css.channelActions}>
                          {channel.active && (
                            <button
                              type="button"
                              className={`${styles.button} ${styles.buttonGhost} ${agenda.action}`}
                              aria-label={`Editar ${channel.label} de ${ownerName(ownerId)}`}
                              disabled={pending}
                              onClick={() => setEditing(channel)}
                            >
                              Editar
                            </button>
                          )}
                          <button
                            type="button"
                            className={`${styles.button} ${styles.buttonGhost} ${agenda.action} ${channel.active ? agenda.danger : ""}`}
                            aria-label={`${channel.active ? "Desativar" : "Redirecionar"} ${channel.label} de ${ownerName(ownerId)}`}
                            disabled={pending}
                            onClick={() => {
                              setRedirectTo(channel.redirect_channel_id ?? "");
                              setDeactivating(channel);
                            }}
                          >
                            {channel.active ? "Desativar" : "Redirecionar"}
                          </button>
                          {!channel.active && (
                            <button
                              type="button"
                              className={`${styles.button} ${styles.buttonGhost} ${agenda.action}`}
                              aria-label={`Reativar ${channel.label} de ${ownerName(ownerId)}`}
                              disabled={pending}
                              onClick={() => perform(channel.id, () => activateChannelAction(channel.id))}
                            >
                              Reativar
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        title={editing === "new" ? "Novo WhatsApp" : "Editar WhatsApp"}
        busy={formBusy}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <ChannelForm
            channel={editing === "new" ? undefined : editing}
            owners={owners}
            ownerName={editing === "new" ? undefined : ownerName(editing.owner_id)}
            save={save}
            onSaved={onSaved}
            onCancel={() => setEditing(null)}
            onBusyChange={setFormBusy}
          />
        )}
      </Dialog>

      <Dialog
        open={deactivating !== null}
        title={deactivating?.active ? "Desativar WhatsApp?" : "Redirecionar links"}
        busy={pending}
        onClose={() => setDeactivating(null)}
      >
        {deactivating && (
          <div className={styles.form}>
            <p className={agenda.confirmShow}>
              <strong>{deactivating.label}</strong>
              <span>
                {formatWhatsApp(deactivating.whatsapp)} · {ownerName(deactivating.owner_id)}
              </span>
            </p>
            <p className={styles.hint}>
              Nenhum link novo poderá usar este número. Os links já criados com ele continuam com os mesmos valores; escolha
              para onde vão os contatos deles. O número original continua registrado em cada link.
            </p>
            <div className={styles.field}>
              <label htmlFor="redirecionar-para" className={styles.label}>
                Contatos dos links deste WhatsApp
              </label>
              <select
                id="redirecionar-para"
                value={redirectTo}
                onChange={(event) => setRedirectTo(event.target.value)}
                className={styles.input}
              >
                <option value="">Não redirecionar (os links deixam de abrir conversa)</option>
                {redirectOptions.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    Redirecionar para {channel.label} · {formatWhatsApp(channel.whatsapp)} ({ownerName(channel.owner_id)})
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonGhost}`}
                disabled={pending}
                onClick={() => setDeactivating(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.button} ${deactivating.active ? styles.buttonDanger : ""}`}
                disabled={pending}
                onClick={() =>
                  perform(
                    deactivating.id,
                    () => deactivateChannelAction(deactivating.id, redirectTo || null),
                    () => setDeactivating(null),
                  )
                }
              >
                {pending ? "Salvando…" : deactivating.active ? "Desativar WhatsApp" : "Salvar"}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
