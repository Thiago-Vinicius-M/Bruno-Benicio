import agenda from "../Agenda/Agenda.module.css";

export function CommercialLinksLoading() {
  return (
    <p className={agenda.state} role="status">
      Carregando links comerciais…
    </p>
  );
}
