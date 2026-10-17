"use client";

import { whatsappShareUrl } from "@/lib/whatsapp";
import agenda from "../Agenda/Agenda.module.css";
import styles from "../Painel.module.css";
import css from "./CommercialLinks.module.css";

type Props = {
  url: string;
  /** Nome do link para os rótulos acessíveis ("Casamento João"). */
  name: string;
  onCopy: () => void;
  /** Link que não funciona agora (expirado, desativado): nada para compartilhar. */
  disabled?: boolean;
  /** `icon`: botões quadrados (linha compacta); `full`: com texto (cartão e modal). */
  variant?: "icon" | "full";
};

/**
 * Copiar o link e enviá-lo pelo WhatsApp (abre o app com o link na mensagem; o vendedor
 * escolhe o contato). Mesmos botões na lista e no modal de link gerado.
 */
export function ShareLinkButtons({ url, name, onCopy, disabled = false, variant = "full" }: Props) {
  const icon = variant === "icon";
  const base = icon ? css.iconButton : `${styles.button} ${styles.buttonGhost} ${agenda.action}`;
  const title = disabled ? "Este link não funciona agora. Crie um novo link." : undefined;

  return (
    <>
      <button type="button" className={base} aria-label={`Copiar link ${name}`} title={title ?? (icon ? "Copiar link" : undefined)} disabled={disabled} onClick={onCopy}>
        {icon ? <CopyIcon /> : "Copiar link"}
      </button>
      {disabled ? (
        <button type="button" className={`${base} ${css.whatsapp}`} aria-label={`Enviar link ${name} pelo WhatsApp`} title={title} disabled>
          {icon ? <WhatsAppIcon /> : "Enviar no WhatsApp"}
        </button>
      ) : (
        <a
          href={whatsappShareUrl(url)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${base} ${css.whatsapp}`}
          aria-label={`Enviar link ${name} pelo WhatsApp`}
          title={icon ? "Enviar no WhatsApp" : undefined}
        >
          {icon ? (
            <WhatsAppIcon />
          ) : (
            <>
              <WhatsAppIcon /> Enviar no WhatsApp
            </>
          )}
        </a>
      )}
    </>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1.1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3Z" />
    </svg>
  );
}
