import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import agenda from "@/components/Painel/Agenda/Agenda.module.css";
import { AgendaLoadError } from "@/components/Painel/Agenda/AgendaLoadError";
import { AgendaLoading } from "@/components/Painel/Agenda/AgendaLoading";
import { AgendaView } from "@/components/Painel/Agenda/AgendaView";
import { PublicAgendaToggle } from "@/components/Painel/Agenda/PublicAgendaToggle";
import styles from "@/components/Painel/Painel.module.css";
import { agendaNow } from "@/lib/agenda/dates";
import { listTeamNames } from "@/lib/agenda/profilesRepository";
import { getAgendaPublicEnabled } from "@/lib/agenda/settingsRepository";
import type { Show } from "@/lib/agenda/types";
import { AGENDA_FILTERS, DEFAULT_AGENDA_FILTER, listAgenda, parseAgendaFilter, type AgendaFilter } from "@/lib/painel/agenda";
import { PANEL_ROUTES } from "@/lib/painel/routes";
import { requirePanelStaff } from "@/lib/painel/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Agenda" };

const filterHref = (filter: AgendaFilter) =>
  filter === DEFAULT_AGENDA_FILTER ? PANEL_ROUTES.agenda : `${PANEL_ROUTES.agenda}?filtro=${filter}`;

/** Agenda administrativa (ADMIN e EDITOR). Só a tabela `shows`: nada do financeiro. */
export default async function AgendaPage({ searchParams }: PageProps<"/painel/agenda">) {
  await requirePanelStaff();
  const filter = parseAgendaFilter((await searchParams).filtro);

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Agenda</h1>
        <p className={styles.pageLead}>Shows da dupla: passados, próximos e excluídos.</p>
      </header>

      <Suspense fallback={null}>
        <PublicAgendaSetting />
      </Suspense>

      <nav className={agenda.tabs} aria-label="Filtrar shows">
        {(Object.keys(AGENDA_FILTERS) as AgendaFilter[]).map((key) => (
          <Link
            key={key}
            href={filterHref(key)}
            className={agenda.tab}
            aria-current={key === filter ? "page" : undefined}
            scroll={false}
          >
            {AGENDA_FILTERS[key].label}
          </Link>
        ))}
      </nav>

      {/* `key`: trocar de filtro mostra o carregamento e reinicia busca/mês. */}
      <Suspense key={filter} fallback={<AgendaLoading />}>
        <AgendaData filter={filter} />
      </Suspense>
    </>
  );
}

/** Interruptor da agenda no site. Sem a configuração, a lista continua funcionando. */
async function PublicAgendaSetting() {
  const client = await createSupabaseServerClient();
  let enabled: boolean | null = null;
  try {
    enabled = await getAgendaPublicEnabled(client);
  } catch (error) {
    console.error("[agenda] falha ao carregar a configuração do site", error);
  }
  if (enabled === null) {
    return (
      <p role="alert" className={`${styles.alert} ${styles.alertError} ${styles.notice}`}>
        Não foi possível carregar a opção “Agenda no site”. Recarregue a página para tentar de novo.
      </p>
    );
  }
  return <PublicAgendaToggle enabled={enabled} />;
}

async function AgendaData({ filter }: { filter: AgendaFilter }) {
  const client = await createSupabaseServerClient();

  let shows: Show[] | null = null;
  try {
    shows = await listAgenda(client, filter);
  } catch (error) {
    console.error("[agenda] falha ao carregar", error);
  }
  if (!shows) return <AgendaLoadError />;

  // Nomes para a auditoria (criado/alterado/excluído por). Sem eles a lista ainda funciona.
  const authors = await listTeamNames(client).catch(() => ({}));

  return <AgendaView shows={shows} filter={filter} authors={authors} now={agendaNow()} />;
}
