/**
 * Opções reutilizadas pelos selects dos painéis (UI).
 * Todos os valores abaixo existem no core do GSAP — nenhum plugin extra.
 * Docs de eases: https://gsap.com/docs/v3/Eases
 */
import type { ControlOption } from "./types";

/** Eases do core (não precisam de plugin). O padrão do GSAP é "power1.out". */
export const EASE_OPTIONS: ControlOption[] = [
  "none",
  "power1.out",
  "power2.out",
  "power3.out",
  "power4.out",
  "power2.in",
  "power2.inOut",
  "sine.inOut",
  "expo.out",
  "circ.out",
  "back.out(1.7)",
  "elastic.out(1, 0.4)",
  "bounce.out",
  "steps(6)",
].map((ease) => ({ label: ease, value: ease }));

/**
 * toggleActions = "onEnter onLeave onEnterBack onLeaveBack"
 * Palavras válidas: play, pause, resume, reset, restart, complete, reverse, none
 */
export const TOGGLE_ACTIONS_OPTIONS: ControlOption[] = [
  "play none none none",
  "play none none reverse",
  "play reverse play reverse",
  "restart none none reset",
  "play pause resume reset",
  "play complete reverse reset",
].map((value) => ({ label: value, value }));

/**
 * scrub:
 *  false → a animação toca sozinha (toggleActions)
 *  true  → o playhead fica "grudado" na barra de rolagem
 *  número → segundos que o playhead leva para "alcançar" a barra de rolagem
 */
export const SCRUB_OPTIONS: ControlOption[] = [
  { label: "true", value: true },
  { label: "0.3", value: 0.3 },
  { label: "0.5", value: 0.5 },
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "4", value: 4 },
];

export const START_SUGGESTIONS = ["top bottom", "top 90%", "top 80%", "top center", "center center", "top top"];
export const END_SUGGESTIONS = ["bottom top", "bottom 20%", "bottom center", "center center", "top top", "+=300", "+=500", "+=1000"];
