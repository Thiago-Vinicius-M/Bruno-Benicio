import agenda from "../Agenda/Agenda.module.css";

export function ShowModelsLoading() {
  return (
    <p className={agenda.state} role="status">
      Carregando modelos de show…
    </p>
  );
}
