import type { Metadata } from "next";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/Painel/ChangePasswordForm";
import { ChannelsPanel } from "@/components/Painel/CommercialLinks/ChannelsPanel";
import agenda from "@/components/Painel/Agenda/Agenda.module.css";
import { LoadError } from "@/components/Painel/LoadError";
import styles from "@/components/Painel/Painel.module.css";
import { listChannelOwners, listChannels } from "@/lib/commercialLinks/channelsRepository";
import type { PanelUser } from "@/lib/painel/access";
import { requirePanelUser } from "@/lib/painel/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Configurações" };

/**
 * Configurações: senha (todos) e, para ADMIN, os WhatsApp dos links comerciais. Na
 * recuperação de senha a página mostra só o formulário de nova senha.
 */
export default async function SettingsPage({ searchParams }: PageProps<"/painel/configuracoes/senha">) {
  const user = await requirePanelUser();
  const { recuperacao } = await searchParams;

  if (recuperacao) {
    return (
      <>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Criar nova senha</h1>
          <p className={styles.pageLead}>Defina a nova senha para concluir a recuperação.</p>
        </header>
        <section className={styles.panel} aria-label="Nova senha">
          <ChangePasswordForm />
        </section>
      </>
    );
  }

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Configurações</h1>
      </header>

      <section className={styles.panel} aria-labelledby="alterar-senha">
        <h2 id="alterar-senha" className={styles.panelTitle}>
          Alterar senha
        </h2>
        <ChangePasswordForm />
      </section>

      {user.role === "ADMIN" && (
        <Suspense
          fallback={
            <p className={agenda.state} role="status">
              Carregando WhatsApp…
            </p>
          }
        >
          <ChannelsData user={user} />
        </Suspense>
      )}
    </>
  );
}

async function ChannelsData({ user }: { user: PanelUser }) {
  const client = await createSupabaseServerClient();
  let data: [Awaited<ReturnType<typeof listChannels>>, Awaited<ReturnType<typeof listChannelOwners>>] | null = null;
  try {
    data = await Promise.all([listChannels(client), listChannelOwners(client)]);
  } catch (error) {
    console.error("[configurações] falha ao carregar os WhatsApp", error);
  }
  if (!data) return <LoadError message="Não foi possível carregar os WhatsApp." />;
  const [channels, owners] = data;

  // O RLS também devolve os números de que o ADMIN é dono (para gerar links); aqui só os que ele cadastrou.
  return <ChannelsPanel channels={channels.filter((channel) => channel.created_by === user.id)} owners={owners} />;
}
