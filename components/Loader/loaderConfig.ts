import type { LoaderExitParams } from "@/animations/loaderExit";

/**
 * Tela de loading — todos os valores ajustáveis ficam aqui.
 *
 * QUANDO SAI
 *   Assim que fontes e imagens da primeira dobra estiverem prontas (lib/pageReady.ts),
 *   depois da hidratação. Não existe espera fixa:
 *   entranceMs   duração da entrada do logo (igual à animação CSS --loader-entrance).
 *                Só segura a saída se a página ficar pronta ANTES de a entrada terminar
 *                (cache quente), para o logo não piscar pela metade. Conta desde o início
 *                da navegação, então em conexões normais não acrescenta nada.
 *   maxWaitMs    teto de segurança: depois disso sai mesmo com recursos pendentes.
 *
 * SAÍDA (animations/loaderExit.ts)
 *   logoDuration / logoY / logoScale   o logo sobe um pouco, encolhe e some.
 *   curtainDuration / curtainEase      a tela sobe como cortina, revelando a página.
 *   curtainOverlap                     a cortina começa antes de o logo terminar de sumir.
 *   reducedFadeDuration                fade simples com prefers-reduced-motion.
 */
export const LOADER = {
  entranceMs: 900,
  maxWaitMs: 6000,
  logoDuration: 0.45,
  logoY: 14,
  logoScale: 0.96,
  curtainDuration: 0.9,
  curtainOverlap: 0.15,
  curtainEase: "expo.inOut",
  reducedFadeDuration: 0.3,
} satisfies LoaderExitParams & { entranceMs: number; maxWaitMs: number };
