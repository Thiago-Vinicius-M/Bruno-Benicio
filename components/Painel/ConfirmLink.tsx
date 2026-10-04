"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { parseAuthFragment, type AuthFragment } from "@/lib/painel/authFragment";
import { PANEL_ROUTES } from "@/lib/painel/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./Painel.module.css";

type Status = "checking" | "invalid" | "expired";

/**
 * Conclui links do Auth que trazem a sessão no fragmento da URL. A sessão é gravada
 * pelo cliente oficial (@supabase/ssr, em cookies) e validada pelo Auth; em seguida o
 * usuário segue para `next` (já sanitizado no servidor), onde o acesso é checado de novo.
 */
export function ConfirmLink({ next }: { next: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  // Lido uma única vez: o efeito pode rodar de novo (StrictMode) depois de limparmos a URL.
  const fragmentRef = useRef<AuthFragment | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function confirm(): Promise<Status | null> {
      fragmentRef.current ??= parseAuthFragment(window.location.hash);
      const fragment = fragmentRef.current;
      // O fragmento contém tokens: sai da barra de endereço e do histórico imediatamente.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);

      if (fragment.kind === "error") return fragment.code === "otp_expired" ? "expired" : "invalid";
      if (fragment.kind === "empty") return "invalid";

      const { error } = await getSupabaseBrowserClient().auth.setSession({
        access_token: fragment.accessToken,
        refresh_token: fragment.refreshToken,
      });
      if (error) return "invalid";
      router.replace(next);
      return null;
    }

    confirm().then((result) => {
      if (!cancelled && result) setStatus(result);
    });
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  if (status === "checking") {
    return (
      <p role="status" className={styles.hint}>
        Validando o link…
      </p>
    );
  }

  return (
    <div className={styles.form}>
      <p role="alert" className={`${styles.alert} ${styles.alertError}`}>
        {status === "expired"
          ? "Este link expirou. Peça um novo convite ao administrador ou use “Esqueci minha senha”."
          : "Link inválido. Peça um novo convite ao administrador ou use “Esqueci minha senha”."}
      </p>
      <Link href={PANEL_ROUTES.recoverPassword} className={styles.link}>
        Esqueci minha senha
      </Link>
      <Link href={PANEL_ROUTES.login} className={styles.link}>
        Ir para o login
      </Link>
    </div>
  );
}
