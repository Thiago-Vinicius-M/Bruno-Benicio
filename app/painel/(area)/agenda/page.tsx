import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import agenda from "@/components/Painel/Agenda/Agenda.module.css";
import { AgendaLoadError } from "@/components/Painel/Agenda/AgendaLoadError";
import { AgendaLoading } from "@/components/Painel/Agenda/AgendaLoading";
import { AgendaView } from "@/components/Painel/Agenda/AgendaView";
import styles from "@/components/Painel/Painel.module.css";
import { agendaNow } from "@/lib/agenda/dates";
import { listTeamNames } from "@/lib/agenda/profilesRepository";
import type { Show } from "@/lib/agenda/types";
import { AGENDA_FILTERS, DEFAULT_AGENDA_FILTER, listAgenda, parseAgendaFilter, type AgendaFilter } from "@/lib/painel/agenda";
import { PANEL_ROUTES } from "@/lib/painel/routes";
import { requirePanelUser } from "@/lib/painel/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Agenda" };

const filterHref = (filter: AgendaFilter) =>
  filter === DEFAULT_AGENDA_FILTER ? PANEL_ROUTES.agenda : `${PANEL_ROUTES.agenda}?filtro=${filter}`;

/** Agenda administrativa (ADMIN e EDITOR). Só a tabela `shows`: nada do financeiro. */
export default async function AgendaPage({ searchParams }: PageProps<"/painel/agenda">) {
  await requirePanelUser();
  const filter = parseAgendaFilter((await searchParams).filtro);

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Agenda</h1>
        <p className={styles.pageLead}>Shows da dupla: passados, próximos e excluídos.</p>
      </header>

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
