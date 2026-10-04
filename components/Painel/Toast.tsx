"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import styles from "./Painel.module.css";

/** Avisos curtos do painel ("Show criado com sucesso."). Sem dependências externas. */
type Tone = "success" | "error";
type Toast = { id: number; message: string; tone: Tone };

const DURATION_MS = 4000;

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const show = useCallback(
    (message: string, tone: Tone = "success") => {
      const id = ++nextId.current;
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={styles.toastRegion} role="status" aria-live="polite">
        {toasts.map((toast) => (
          <p key={toast.id} className={`${styles.toast} ${toast.tone === "error" ? styles.toastError : ""}`}>
            <span>{toast.message}</span>
            <button type="button" className={styles.toastClose} aria-label="Fechar aviso" onClick={() => dismiss(toast.id)}>
              ×
            </button>
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
