"use client";

import { useCallback, useState, useTransition } from "react";
import {
  createSellerAction,
  setSellerActiveAction,
  updateSellerAction,
} from "@/app/painel/(area)/vendedores/actions";
import type { SellerActionResult } from "@/lib/painel/sellers";
import { sellerLinkUrl } from "@/lib/sellers/sellerLink";
import type { Seller, SellerInput } from "@/lib/sellers/types";
import { formatWhatsApp } from "@/lib/whatsapp";
import agenda from "../Agenda/Agenda.module.css";
import { Dialog } from "../Dialog";
import styles from "../Painel.module.css";
import { useToast } from "../Toast";
import users from "../Usuarios/Users.module.css";
import { SellerForm } from "./SellerForm";
import css from "./Sellers.module.css";

type Props = {
  sellers: Seller[];
  /** Origem pública do site, para montar os links (https://dominio). */
  siteOrigin: string;
};

const NETWORK_ERROR = "Não foi possível concluir a operação. Verifique a conexão e tente novamente.";

/**
 * Vendedores e links comerciais (só ADMIN). O link é gerado pelo banco e não muda ao
 * editar nome ou número. Desativar invalida o link sem apagar o cadastro.
 */
export function SellersView({ sellers, siteOrigin }: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Seller | "new" | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [deactivating, setDeactivating] = useState<Seller | null>(null);

  const linkOf = (seller: Seller) => sellerLinkUrl(siteOrigin, seller.code);

  function perform(id: string, action: () => Promise<SellerActionResult>, onSuccess?: () => void) {
    if (pending) return;
    setBusyId(id);
    startTransition(async () => {
      let result: SellerActionResult;
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

  async function copyLink(seller: Seller) {
    try {
      await navigator.clipboard.writeText(linkOf(seller));
      toast(`Link de ${seller.name} copiado.`);
    } catch {
      // Sem permissão ou fora de HTTPS: o link continua visível para copiar à mão.
      toast("Não foi possível copiar. Selecione o link e copie manualmente.", "error");
    }
  }

  const save = useCallback(
    (input: SellerInput) => {
      const target = editing;
      if (!target) return Promise.resolve<SellerActionResult>({ status: "error", message: "Vendedor inválido." });
      return target === "new" ? createSellerAction(input) : updateSellerAction(target.id, input);
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

  return (
    <>
      <div className={agenda.toolbar}>
        <button type="button" className={styles.button} onClick={() => setEditing("new")}>
          + Novo vendedor
        </button>
      </div>

      {sellers.length === 0 ? (
        <div className={agenda.empty}>
          <p>Nenhum vendedor cadastrado. Cadastre um para gerar o link de atendimento dele.</p>
          <button type="button" className={styles.button} onClick={() => setEditing("new")}>
            + Cadastrar vendedor
          </button>
        </div>
      ) : (
        <ul className={agenda.list} aria-label="Vendedores">
          {sellers.map((seller) => {
            const link = linkOf(seller);
            return (
              <li
                key={seller.id}
                className={css.row}
                data-inactive={!seller.active || undefined}
                aria-busy={busyId === seller.id || undefined}
              >
                <div className={css.identity}>
                  <p className={css.name}>
                    {seller.name}
                    <span className={users.state} data-state={seller.active ? "active" : "inactive"}>
                      {seller.active ? "Link ativo" : "Link desativado"}
                    </span>
                  </p>
                  <p className={agenda.meta}>WhatsApp {formatWhatsApp(seller.whatsapp)}</p>
                </div>

                <div className={css.link}>
                  <input
                    readOnly
                    value={link}
                    aria-label={`Link de ${seller.name}`}
                    className={`${styles.input} ${css.linkInput}`}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonGhost} ${agenda.action}`}
                    aria-label={`Copiar link de ${seller.name}`}
                    disabled={!seller.active}
                    title={seller.active ? undefined : "Ative o vendedor para o link voltar a funcionar."}
                    onClick={() => copyLink(seller)}
                  >
                    Copiar link
                  </button>
                </div>

                <div className={`${agenda.actions} ${css.actions}`}>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonGhost} ${agenda.action}`}
                    aria-label={`Editar ${seller.name}`}
                    disabled={pending}
                    onClick={() => setEditing(seller)}
                  >
                    Editar
                  </button>
                  {seller.active ? (
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonGhost} ${agenda.action} ${agenda.danger}`}
                      aria-label={`Desativar ${seller.name}`}
                      disabled={pending}
                      onClick={() => setDeactivating(seller)}
                    >
                      Desativar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonGhost} ${agenda.action}`}
                      aria-label={`Ativar ${seller.name}`}
                      disabled={pending}
                      onClick={() => perform(seller.id, () => setSellerActiveAction(seller.id, true))}
                    >
                      Ativar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        title={editing === "new" ? "Novo vendedor" : "Editar vendedor"}
        busy={formBusy}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <SellerForm
            seller={editing === "new" ? undefined : editing}
            save={save}
            onSaved={onSaved}
            onCancel={() => setEditing(null)}
            onBusyChange={setFormBusy}
          />
        )}
      </Dialog>

      <Dialog
        open={deactivating !== null}
        title="Desativar vendedor?"
        busy={pending}
        onClose={() => setDeactivating(null)}
      >
        {deactivating && (
          <>
            <p className={agenda.confirmShow}>
              <strong>{deactivating.name}</strong>
              <span>WhatsApp {formatWhatsApp(deactivating.whatsapp)}</span>
            </p>
            <p className={styles.hint}>
              O link deste vendedor deixa de funcionar: quem abrir vê um aviso de link desativado, e o “Voltar ao
              WhatsApp” não leva mais a este número. O cadastro continua e pode ser reativado.
            </p>
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
                className={`${styles.button} ${styles.buttonDanger}`}
                disabled={pending}
                onClick={() =>
                  perform(deactivating.id, () => setSellerActiveAction(deactivating.id, false), () => setDeactivating(null))
                }
              >
                {pending ? "Desativando…" : "Desativar vendedor"}
              </button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
