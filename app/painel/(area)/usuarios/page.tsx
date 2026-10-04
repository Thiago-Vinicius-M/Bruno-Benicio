import type { Metadata } from "next";
import { Suspense } from "react";
import agenda from "@/components/Painel/Agenda/Agenda.module.css";
import { LoadError } from "@/components/Painel/LoadError";
import styles from "@/components/Painel/Painel.module.css";
import { UsersView } from "@/components/Painel/Usuarios/UsersView";
import { listUsers, type TeamMember } from "@/lib/agenda/usersAdmin";
import { requirePanelAdmin } from "@/lib/painel/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Usuários" };

/** Exclusiva de ADMIN: visitante vai ao login, EDITOR/desativado a "acesso negado". */
export default async function UsersPage() {
  const me = await requirePanelAdmin();

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Usuários</h1>
        <p className={styles.pageLead}>Quem acessa o painel, com qual perfil.</p>
      </header>

      <Suspense
        fallback={
          <p className={agenda.state} role="status">
            Carregando usuários…
          </p>
        }
      >
        <UsersData currentUserId={me.id} />
      </Suspense>
    </>
  );
}

async function UsersData({ currentUserId }: { currentUserId: string }) {
  let members: TeamMember[] | null = null;
  try {
    members = await listUsers({ caller: await createSupabaseServerClient(), admin: createSupabaseAdminClient() });
  } catch (error) {
    console.error("[usuarios] falha ao carregar", error);
  }
  if (!members) return <LoadError message="Não foi possível carregar os usuários." />;
  return <UsersView members={members} currentUserId={currentUserId} />;
}
