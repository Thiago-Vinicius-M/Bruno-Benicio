"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./Painel.module.css";

/**
 * Modal do painel sobre o `<dialog>` nativo: foco preso, Esc e fundo inerte vêm do
 * navegador. O conteúdo só é montado aberto (formulários sempre começam limpos).
 * `busy` impede fechar no meio de uma operação.
 */
export function Dialog({
  open,
  title,
  onClose,
  busy = false,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault(); // Esc: fecha pelo estado do React, não por fora dele.
        if (!busy) onClose();
      }}
    >
      {open && (
        <>
          <h2 id={titleId} className={styles.dialogTitle}>
            {title}
          </h2>
          {children}
        </>
      )}
    </dialog>
  );
}
