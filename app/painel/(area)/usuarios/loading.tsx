import agenda from "@/components/Painel/Agenda/Agenda.module.css";

export default function UsersLoading() {
  return (
    <p className={agenda.state} role="status">
      Carregando usuários…
    </p>
  );
}
