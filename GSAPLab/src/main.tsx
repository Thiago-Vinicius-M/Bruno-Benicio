import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// 1º: registra ScrollTrigger + useGSAP antes de qualquer componente animar
import "./lib/gsapSetup";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./styles/global.css";
import { App } from "./App";

// StrictMode monta → desmonta → monta os efeitos em desenvolvimento.
// É um ótimo teste: se o cleanup estiver errado, você veria ScrollTriggers
// e markers duplicados. Com useGSAP, tudo é revertido corretamente.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
