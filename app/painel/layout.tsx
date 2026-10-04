import type { Metadata } from "next";
import styles from "@/components/Painel/Painel.module.css";

export const metadata: Metadata = {
  title: { template: "%s · Painel Bruno & Benício", default: "Painel · Bruno & Benício" },
  // Área privada: fora dos buscadores.
  robots: { index: false, follow: false },
};

/** Raiz de todo o painel (inclusive login): isola visual e tokens do site público. */
export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return <div className={styles.root}>{children}</div>;
}
