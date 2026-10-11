import type { Metadata } from "next";
import Link from "next/link";
import type { InvalidLinkReason } from "@/lib/sellers/sellerLink";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Link indisponível",
  robots: { index: false, follow: false },
};

const MESSAGES: Record<InvalidLinkReason, { title: string; text: string }> = {
  malformado: {
    title: "Link incompleto",
    text: "Este link de atendimento está incompleto ou foi alterado. Confira se ele foi copiado inteiro.",
  },
  inexistente: {
    title: "Link não encontrado",
    text: "Não encontramos este link de atendimento. Peça um novo link a quem enviou.",
  },
  inativo: {
    title: "Link desativado",
    text: "Este link de atendimento não está mais ativo. Peça um novo link a quem enviou ou fale com a gente pelos contatos do site.",
  },
  indisponivel: {
    title: "Não foi possível abrir o link",
    text: "Tivemos um problema para verificar este link agora. Tente abrir de novo em instantes.",
  },
};

/**
 * Destino dos links comerciais (/r/<código>) que não puderam ser usados. Não associa
 * nenhum vendedor: oferece o site e os contatos públicos.
 */
export default async function InvalidLinkPage({ searchParams }: PageProps<"/link-invalido">) {
  const { motivo } = await searchParams;
  const reason: InvalidLinkReason = typeof motivo === "string" && motivo in MESSAGES ? (motivo as InvalidLinkReason) : "inexistente";
  const { title, text } = MESSAGES[reason];

  return (
    <main className={styles.page}>
      <div className={`container-narrow ${styles.stage}`}>
        <p className={`type-nav ${styles.eyebrow}`}>Bruno &amp; Benício</p>
        <h1 className="type-title">{title}</h1>
        <p className={`type-body ${styles.text}`}>{text}</p>
        <div className={styles.actions}>
          <Link href="/" className={styles.button}>
            Ir para o site
          </Link>
          <Link href="/#contato" className={styles.link}>
            Ver contatos
          </Link>
        </div>
      </div>
    </main>
  );
}
