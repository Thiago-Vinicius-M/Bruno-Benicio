import agenda from "./Agenda.module.css";

export function AgendaLoading() {
  return (
    <p className={agenda.state} role="status">
      Carregando agenda…
    </p>
  );
}
