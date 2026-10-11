import agenda from "../Agenda/Agenda.module.css";

export function SellersLoading() {
  return (
    <p className={agenda.state} role="status">
      Carregando vendedores…
    </p>
  );
}
