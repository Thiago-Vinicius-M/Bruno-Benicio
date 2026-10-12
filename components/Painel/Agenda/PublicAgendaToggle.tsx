"use client";

import { useTransition } from "react";
import { setAgendaPublicAction } from "@/app/painel/(area)/agenda/actions";
import styles from "../Painel.module.css";
import { useToast } from "../Toast";
import agenda from "./Agenda.module.css";

const NETWORK_ERROR = "Não foi possível concluir a operação. Verifique a conexão e tente novamente.";

/**
 * Habilita/desabilita a agenda no site: habilitada, a Home mostra a seção AGENDA (shows do
 * mês atual que ainda vão acontecer, depois de VIDEOS/MÚSICAS) e o link AGENDA na topbar e
 * no menu lateral. O estado vem do servidor (revalidado pela Server Action).
 */
export function PublicAgendaToggle({ enabled }: { enabled: boolean }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    startTransition(async () => {
      try {
        const result = await setAgendaPublicAction(!enabled);
        toast(result.message, result.status);
      } catch {
        toast(NETWORK_ERROR, "error");
      }
    });
  }

  return (
    <section className={agenda.publicToggle} aria-labelledby="agenda-site-title">
      <div className={agenda.publicToggleText}>
        <h2 id="agenda-site-title" className={agenda.publicToggleTitle}>
          Agenda no site
          <span className={agenda.publicState} data-enabled={enabled || undefined}>
            {enabled ? "Habilitada" : "Desabilitada"}
          </span>
        </h2>
        <p className={styles.hint}>
          {enabled
            ? "A Home mostra os próximos shows do mês atual, depois de Vídeos/Músicas, e o link AGENDA aparece no menu."
            : "A agenda não aparece no site. Ao habilitar, os próximos shows do mês aparecem na Home e no menu."}
        </p>
      </div>
      <button
        type="button"
        className={enabled ? `${styles.button} ${styles.buttonGhost}` : styles.button}
        disabled={pending}
        onClick={toggle}
      >
        {pending ? "Salvando…" : enabled ? "Desabilitar agenda" : "Habilitar agenda"}
      </button>
    </section>
  );
}
