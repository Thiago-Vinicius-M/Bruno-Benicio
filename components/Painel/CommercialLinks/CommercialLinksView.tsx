"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createCommercialLinkAction,
  deactivateCommercialLinkAction,
} from "@/app/painel/(area)/links/actions";
import type {
  ChannelOwner,
  CommercialLink,
  LinkModel,
  LinkPermissions,
  WhatsAppChannel,
} from "@/lib/commercialLinks/types";
import type { PanelUser } from "@/lib/painel/access";
import type { ActionResult } from "@/lib/painel/actionResult";
import { NEW_LINK_PARAM } from "@/lib/painel/routes";
import agenda from "../Agenda/Agenda.module.css";
import { Dialog } from "../Dialog";
import styles from "../Painel.module.css";
import { useToast } from "../Toast";
import { ChannelsPanel } from "./ChannelsPanel";
import css from "./CommercialLinks.module.css";
import { LinkForm } from "./LinkForm";
import { commercialLinkName } from "./LinkHistory";
import { LinkSections } from "./LinkSections";

type Props = {
  user: PanelUser;
  permissions: LinkPermissions;
  /** ADMIN: todos; SELLER: os próprios (filtrado pelo banco). */
  links: CommercialLink[];
  /** ADMIN: todos (para administrar); SELLER: os próprios (RLS). */
  channels: WhatsAppChannel[];
  models: LinkModel[];
  /** Só ADMIN. */
  owners: ChannelOwner[];
  siteOrigin: string;
};

const NETWORK_ERROR =
  "Não foi possível concluir a operação. Verifique a conexão e tente novamente.";

/**
 * Links comerciais. Qualquer usuário com permissão (ADMIN/SELLER) cria links com um dos
 * próprios WhatsApp ativos e vê o histórico; o ADMIN também administra os WhatsApp de
 * todos. A interface só esconde o que não se aplica: as regras
 * (dono do canal, valores, quem desativa) são conferidas pelo servidor e pelo banco.
 */
export function CommercialLinksView({
  user,
  permissions,
  links,
  channels,
  models,
  owners,
  siteOrigin,
}: Props) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [revoking, setRevoking] = useState<CommercialLink | null>(null);

  const isAdmin = user.role === "ADMIN";
  // Só os próprios canais ativos entram no formulário (o ADMIN também usa os dele).
  const myChannels = channels.filter(
    (channel) => channel.owner_id === user.id && channel.active,
  );
  const blocker = !permissions.canCreate
    ? "Seu perfil não pode criar links comerciais."
    : myChannels.length === 0
      ? "Você ainda não tem um WhatsApp ativo cadastrado. Peça a um administrador para cadastrar o seu número."
      : models.length === 0
        ? "Nenhum modelo de show ativo. Ative ao menos um em Modelos de Show."
        : null;

  // O atalho "Gerar link" do topo chega aqui com ?novo=1 (de qualquer tela do painel).
  const requested = searchParams.get(NEW_LINK_PARAM) === "1";
  const formOpen = (creating || requested) && blocker === null;

  function closeForm() {
    setCreating(false);
    // Tira o parâmetro para o atalho poder abrir o formulário de novo depois.
    if (requested) router.replace(pathname, { scroll: false });
  }

  function perform(
    id: string,
    action: () => Promise<ActionResult>,
    onSuccess?: () => void,
  ) {
    if (pending) return;
    setBusyId(id);
    startTransition(async () => {
      let result: ActionResult;
      try {
        result = await action();
      } catch {
        result = { status: "error", message: NETWORK_ERROR };
      }
      setBusyId(null);
      if (result.status === "success") {
        onSuccess?.();
        toast(result.message);
      } else {
        toast(result.message, "error");
      }
    });
  }

  /** `name` completa a frase do aviso: "Link “Casamento João” copiado." */
  async function copyUrl(url: string, name: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast(`Link ${name} copiado.`);
    } catch {
      // Sem permissão ou fora de HTTPS: o link continua visível para copiar à mão.
      toast(
        "Não foi possível copiar. Selecione o link e copie manualmente.",
        "error",
      );
    }
  }

  return (
    <>
      <div className={css.cta}>
        <button
          type="button"
          className={`${styles.button} ${css.ctaButton}`}
          disabled={blocker !== null}
          onClick={() => setCreating(true)}
        >
          <span aria-hidden="true">+</span> Gerar link
        </button>
        <p className={css.ctaText}>
          Escolha o WhatsApp e os formatos de show, revise e envie o link ao
          cliente.
        </p>
      </div>
      {blocker && (
        <p role="status" className={`${styles.alert} ${styles.alertError}`}>
          {blocker}
        </p>
      )}

      <LinkSections
        title={isAdmin ? "Links gerados" : "Meus links"}
        links={links}
        siteOrigin={siteOrigin}
        showAuthor={isAdmin}
        busyId={busyId}
        pending={pending}
        onCopy={copyUrl}
        onDeactivate={setRevoking}
      />

      {isAdmin && (
        <ChannelsPanel channels={channels} owners={owners} busyId={busyId} pending={pending} perform={perform} />
      )}

      <Dialog
        open={formOpen}
        title="Novo link comercial"
        busy={formBusy}
        wide
        onClose={closeForm}
      >
        {formOpen && (
          <LinkForm
            channels={myChannels}
            models={models}
            canCustomizePrices={permissions.canCustomizePrices}
            siteOrigin={siteOrigin}
            save={createCommercialLinkAction}
            onCopy={(url) => copyUrl(url, "comercial")}
            onDone={closeForm}
            onBusyChange={setFormBusy}
          />
        )}
      </Dialog>

      <Dialog
        open={revoking !== null}
        title="Desativar link?"
        busy={pending}
        onClose={() => setRevoking(null)}
      >
        {revoking && (
          <>
            <p className={agenda.confirmShow}>
              <strong>{commercialLinkName(revoking)}</strong>
            </p>
            <p className={styles.hint}>
              O link deixa de funcionar na hora: quem abrir vê o site sem
              valores, e o “Voltar ao WhatsApp” fica bloqueado. O histórico e os
              valores continuam registrados. Não é possível reativar.
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonGhost}`}
                disabled={pending}
                onClick={() => setRevoking(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonDanger}`}
                disabled={pending}
                onClick={() =>
                  perform(
                    revoking.id,
                    () => deactivateCommercialLinkAction(revoking.id),
                    () => setRevoking(null),
                  )
                }
              >
                {pending ? "Desativando…" : "Desativar link"}
              </button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
