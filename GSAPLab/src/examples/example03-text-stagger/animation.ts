/**
 * ============================================================================
 * EXEMPLO 03 — TEXTO COM STAGGER
 * ============================================================================
 *
 * CONCEITO PRINCIPAL: um tween, VÁRIOS alvos, inícios escalonados
 *   Em vez de criar um tween por palavra, passamos um ARRAY de elementos para
 *   UM tween e usamos `stagger` para defasar o início de cada um:
 *
 *     palavra 1  ▶━━━━━━━━┓
 *     palavra 2    ▶━━━━━━━━┓          ← cada uma começa `each` segundos
 *     palavra 3      ▶━━━━━━━━┓          depois da anterior
 *                ├─┤
 *                each
 *
 * QUERY DE MÚLTIPLOS ELEMENTOS
 *   gsap.utils.toArray(".js-stagger-target", container)
 *   → retorna um Array com os elementos que batem com o seletor, MAS apenas
 *     os descendentes de `container` (escopo). Nada de querySelector global:
 *     outro exemplo na página com a mesma classe não seria afetado.
 *   (Alternativas: `container.querySelectorAll(...)`, ou o `scope` do
 *   useGSAP, que faz os seletores em texto valerem só dentro do container.)
 *
 * stagger — formas de escrever
 *   stagger: 0.1                          → atalho para { each: 0.1 }
 *   stagger: { each: 0.1 }                → 0.1s entre o início de cada alvo
 *   stagger: { amount: 0.6 }              → 0.6s no TOTAL, divididos entre os
 *                                           alvos (mais alvos = intervalo menor)
 *   stagger: { each: 0.1, from: "center" } → a "onda" começa no centro
 *
 *   each   = intervalo FIXO entre alvos. 3 palavras × 0.1 → última começa em 0.2s;
 *            23 letras × 0.1 → última começa em 2.2s (demora!)
 *   amount = duração TOTAL do escalonamento. amount 0.6 com 3 palavras → 0.3s
 *            entre cada; com 23 letras → ~0.027s entre cada. O tempo total
 *            fica o mesmo, não importa quantos alvos existam.
 *
 *   from (direção): "start" (padrão) | "end" | "center" | "edges" | "random"
 *                   | índice (ex.: 4) — de onde a "onda" parte.
 *
 * stagger: 0.1 vs 0.3
 *   0.1 → as palavras quase se sobrepõem: parece UM movimento fluido.
 *   0.3 → cada palavra termina boa parte do seu movimento antes da próxima
 *         começar: parece uma SEQUÊNCIA, mais lenta e enfática.
 *
 * O EFEITO "MÁSCARA"
 *   Cada palavra está dentro de um <span> com overflow: hidden (CSS). Animar
 *   yPercent: 110 → 0 faz o texto "subir de dentro da linha". yPercent é
 *   relativo à altura do PRÓPRIO elemento: 110% = um pouco mais que a altura
 *   dele, então ele começa totalmente escondido abaixo da máscara.
 *
 * Docs: https://gsap.com/resources/getting-started/Staggers
 *       https://gsap.com/docs/v3/GSAP/UtilityMethods/toArray()
 */
import { gsap } from "gsap";
import { DEBUG_SCROLL } from "../../config/debug";
import { MEDIA, type MediaConditions } from "../../lib/media";

/* ---------------------------------------------------------------------------
 * PARÂMETROS
 * ------------------------------------------------------------------------- */
export type StaggerFrom = "start" | "center" | "end" | "edges" | "random";

export type TextStaggerParams = {
  /** divide a frase em palavras ou letras (feito no JSX do componente) */
  split: "words" | "chars";
  staggerMode: "each" | "amount";
  staggerValue: number;
  from: StaggerFrom;
  yPercent: number;
  rotation: number;
  duration: number;
  ease: string;
  start: string;
  toggleActions: string;
  markers: boolean;
};

export const TEXT_STAGGER_DEFAULTS: TextStaggerParams = {
  split: "words",
  staggerMode: "each",
  staggerValue: 0.1,
  from: "start",
  yPercent: 110,
  rotation: 8,
  duration: 0.8,
  ease: "power3.out",
  start: "top 75%",
  toggleActions: "play none none reverse",
  markers: DEBUG_SCROLL,
};

/** Monta o objeto stagger exatamente como o GSAP espera */
export function buildStagger(p: TextStaggerParams): gsap.StaggerVars {
  return p.staggerMode === "each" ? { each: p.staggerValue, from: p.from } : { amount: p.staggerValue, from: p.from };
}

export type TextStaggerElements = {
  /** container da frase — é o trigger e o ESCOPO da busca pelos alvos */
  container: HTMLElement;
};

export type TextStaggerHooks = {
  onCreated?: (info: { targets: number; totalDuration: number }) => void;
};

export function createTextStagger(el: TextStaggerElements, params: TextStaggerParams, hooks: TextStaggerHooks = {}) {
  const mm = gsap.matchMedia();

  mm.add(MEDIA, (context) => {
    const { isMobile, reduceMotion } = context.conditions as MediaConditions;

    // 1. QUERY: todos os alvos DENTRO do container (palavras ou letras)
    const targets = gsap.utils.toArray<HTMLElement>(".js-stagger-target", el.container);

    if (reduceMotion) return; // frase estática e legível

    // 2. UM tween para TODOS os alvos, com inícios escalonados
    const tween = gsap.from(targets, {
      yPercent: params.yPercent,
      // no mobile a frase quebra em várias linhas: rotação menor fica mais limpa
      rotation: isMobile ? params.rotation / 2 : params.rotation,
      opacity: 0,
      duration: params.duration,
      ease: params.ease,
      stagger: buildStagger(params),
      scrollTrigger: {
        id: "03-text-stagger",
        trigger: el.container,
        start: params.start,
        toggleActions: params.toggleActions,
        markers: params.markers,
      },
    });

    // duration() de um tween com stagger inclui o escalonamento:
    // duração de UM alvo + atraso do último alvo.
    hooks.onCreated?.({ targets: targets.length, totalDuration: tween.duration() });
  });

  return mm;
}
