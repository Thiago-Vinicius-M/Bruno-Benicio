"use client";

import { useCallback, useState, useTransition } from "react";
import {
  createShowModelAction,
  moveShowModelAction,
  setShowModelActiveAction,
  updateShowModelAction,
} from "@/app/painel/(area)/modelos/actions";
import type { ShowModelActionResult } from "@/lib/painel/showModels";
import { formatTimestamp } from "@/lib/painel/showFormat";
import { formatPrice } from "@/lib/showModels/price";
import type { ShowModel, ShowModelInput } from "@/lib/showModels/types";
import agenda from "../Agenda/Agenda.module.css";
import { Dialog } from "../Dialog";
import styles from "../Painel.module.css";
import { useToast } from "../Toast";
import videos from "../Videos/Videos.module.css";
import css from "./ShowModels.module.css";
import { ShowModelForm } from "./ShowModelForm";

type Props = {
  /** Na ordem de exibição (position). */
  models: ShowModel[];
  /** Nomes da equipe por id, para exibir a auditoria. */
  authors: Record<string, string>;
};

const NETWORK_ERROR = "Não foi possível concluir a operação. Verifique a conexão e tente novamente.";

/**
 * Modelos de show (só ADMIN). Desativar tira o modelo do site sem apagá-lo; não há
 * exclusão. Esconder ações é conveniência: o servidor e o RLS barram o resto.
 */
export function ShowModelsView({ models, authors }: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ShowModel | "new" | null>(null);
  const [formBusy, setFormBusy] = useState(false);

  const activeCount = models.filter((model) => model.active).length;
  const author = (id: string | null) => (id ? (authors[id] ?? "usuário removido") : "importado do site");

  /** Executa uma Server Action sem envios paralelos; a lista volta revalidada. */
  function perform(id: string, action: () => Promise<ShowModelActionResult>) {
    if (pending) return;
    setBusyId(id);
    startTransition(async () => {
      let result: ShowModelActionResult;
      try {
        result = await action();
      } catch {
        result = { status: "error", message: NETWORK_ERROR };
      }
      setBusyId(null);
      if (result.status === "error") toast(result.message, "error");
      // Mudar a ordem é frequente: sem aviso, a própria lista mostra o resultado.
      else if (result.message !== "Ordem atualizada.") toast(result.message);
    });
  }

  const save = useCallback(
    (input: ShowModelInput) => {
      const target = editing;
      if (!target) return Promise.resolve<ShowModelActionResult>({ status: "error", message: "Modelo de show inválido." });
      return target === "new" ? createShowModelAction(input) : updateShowModelAction(target.id, input);
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
          + Novo modelo
        </button>
      </div>

      {models.length === 0 ? (
        <div className={agenda.empty}>
          <p>Nenhum modelo cadastrado. A seção “Nosso show” mostra um aviso para usar os contatos.</p>
          <button type="button" className={styles.button} onClick={() => setEditing("new")}>
            + Adicionar modelo
          </button>
        </div>
      ) : (
        <section aria-labelledby="modelos-lista">
          <div className={css.header}>
            <h2 id="modelos-lista" className={agenda.groupTitle}>
              Ordem no site
            </h2>
            <p className={styles.hint}>
              {activeCount === 0
                ? "Nenhum modelo ativo: a seção “Nosso show” mostra um aviso para usar os contatos."
                : `${activeCount} de ${models.length} ${models.length === 1 ? "modelo ativo" : "modelos ativos"} no site.`}
            </p>
          </div>

          <ol className={`${agenda.list} ${css.list}`}>
            {models.map((model, index) => {
              const busy = busyId === model.id;
              return (
                <li key={model.id} className={css.item} data-inactive={!model.active || undefined} aria-busy={busy || undefined}>
                  <span className={videos.number}>{index + 1}</span>
                  <div className={css.info}>
                    <p className={css.name}>
                      {model.name}
                      <span className={agenda.state} data-state={model.active ? "active" : "inactive"}>
                        {model.active ? "Ativo" : "Inativo"}
                      </span>
                    </p>
                    <p className={agenda.meta}>
                      {model.duration}
                      {model.description && ` · ${model.description}`}
                    </p>
                  </div>
                  <p className={css.price}>{formatPrice(model.price)}</p>
                  <div className={`${videos.order} ${css.order}`} role="group" aria-label={`Ordem de ${model.name}`}>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonGhost} ${videos.iconButton}`}
                      aria-label={`Subir ${model.name}`}
                      disabled={pending || index === 0}
                      onClick={() => perform(model.id, () => moveShowModelAction(model.id, "up"))}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonGhost} ${videos.iconButton}`}
                      aria-label={`Descer ${model.name}`}
                      disabled={pending || index === models.length - 1}
                      onClick={() => perform(model.id, () => moveShowModelAction(model.id, "down"))}
                    >
                      ↓
                    </button>
                  </div>
                  <div className={`${agenda.actions} ${css.actions}`}>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonGhost} ${agenda.action}`}
                      aria-label={`Editar ${model.name}`}
                      disabled={pending}
                      onClick={() => setEditing(model)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonGhost} ${agenda.action}`}
                      aria-label={`${model.active ? "Desativar" : "Ativar"} ${model.name}`}
                      disabled={pending}
                      onClick={() => perform(model.id, () => setShowModelActiveAction(model.id, !model.active))}
                    >
                      {model.active ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <Dialog
        open={editing !== null}
        title={editing === "new" ? "Novo modelo de show" : "Editar modelo de show"}
        busy={formBusy}
        onClose={() => setEditing(null)}
      >
        {editing && editing !== "new" && (
          <p className={`${styles.hint} ${agenda.audit}`}>
            Adicionado por {author(editing.created_by)} em {formatTimestamp(editing.created_at)}
            {editing.updated_at !== editing.created_at &&
              ` · Última alteração por ${author(editing.updated_by)} em ${formatTimestamp(editing.updated_at)}`}
          </p>
        )}
        {editing && (
          <ShowModelForm
            model={editing === "new" ? undefined : editing}
            save={save}
            onSaved={onSaved}
            onCancel={() => setEditing(null)}
            onBusyChange={setFormBusy}
          />
        )}
      </Dialog>
    </>
  );
}
