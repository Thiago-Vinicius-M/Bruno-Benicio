import agenda from "../Agenda/Agenda.module.css";

export function VideosLoading() {
  return (
    <p className={agenda.state} role="status">
      Carregando vídeos…
    </p>
  );
}
