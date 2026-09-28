import type { AtmosphereDriftParams } from "@/animations/atmosphereDrift";
import { mergeAtmosphere } from "./atmosphereStyle";
// versão web (1920px, WebP) de Texturas/sergey-kotenev--gWSFS8rrVg-unsplash.jpg
// alternativa: "@/Texturas/web/concreto-1920.webp" (Texturas/annie-spratt-6a3nqQ1YwBw-unsplash.jpg)
import textureImage from "@/Texturas/web/lousa-1920.webp";

/**
 * Atmosfera de fundo — TODOS os valores ajustáveis do efeito ficam aqui.
 * Tutorial completo (com exemplos de cada propriedade): ./README.md
 *
 * CAMADAS (de trás para frente)
 *   base      → cor de fundo, levemente mais clara no centro
 *   texture   → imagem de superfície (concreto) misturada à base
 *   lights    → grupo das luzes (intensity multiplica todas elas)
 *     haze      → véu de luz muito aberto (vazamento de refletor no topo)
 *     redGlow   → luz vinho/bordô
 *     warmGlow  → luz âmbar/dourado queimado
 *     beams     → feixes de luz (opcional)
 *     particles → poeira iluminada / bokeh
 *   vignette  → escurece as bordas da tela
 *   grain     → ruído de filme que tira o aspecto de "cor sólida digital"
 *
 * UNIDADES
 *   x / y     → % da tela (0 = esquerda/topo · 100 = direita/base; pode passar de 0–100)
 *   size      → vmax (1vmax = 1% do MAIOR lado da tela) — acompanha qualquer tamanho de tela
 *   opacity   → 0–1 · cores em hex ("#c7782e")
 *
 * REGRA DE OURO: se você passou a "ver" o fundo antes de ver o conteúdo, está forte demais.
 */

export type Range = readonly [min: number, max: number];

export type GlowConfig = {
  color: string;
  /** centro da luz, em % da tela */
  x: number;
  y: number;
  /** largura, em vmax */
  size: number;
  /** largura ÷ altura (1 = círculo · 2 = elipse deitada) */
  ratio: number;
  opacity: number;
  /** 0 = núcleo mais denso e borda definida · 1 = decai por igual até a borda (mais difuso) */
  softness: number;
};

export type BeamConfig = {
  /** origem do feixe (o "refletor"), em % da tela — y negativo = acima da tela */
  x: number;
  y: number;
  /** inclinação em graus: 0 = para baixo · positivo = para a direita · negativo = para a esquerda */
  angle: number;
  /** abertura do cone, em graus */
  spread: number;
  /** alcance, em % da diagonal da tela a partir da origem */
  length: number;
  opacity: number;
};

export type AtmosphereConfig = {
  /** multiplicador de TODAS as luzes (glows, haze, feixes, partículas). 1 = como desenhado */
  intensity: number;
  base: { center: string; edge: string };
  /** imagem de superfície (parede, concreto, tecido) por cima da base e atrás das luzes */
  texture: {
    enabled: boolean;
    /** URL da imagem — use um import estático (ex.: textureImage.src) */
    src: string;
    opacity: number;
    /** "cover" = uma imagem cobrindo a tela · "512px" etc. = ladrilho repetido (imagem seamless) */
    size: string;
    /**
     * Como a textura se mistura com a base: "normal" mantém as cores da foto · "luminosity"
     * usa só o relevo (claro/escuro) e mantém a cor da base · "overlay"/"soft-light" só realçam.
     */
    blendMode:
      | "normal"
      | "luminosity"
      | "overlay"
      | "soft-light"
      | "multiply"
      | "screen";
  };
  grain: {
    opacity: number;
    /** lado do ladrilho de ruído, em px (maior = grão mais "espalhado") */
    size: number;
    /** frequência do ruído: 0.6 grão grosso · 0.85 filme fino · 1.2 quase pó */
    frequency: number;
  };
  vignette: {
    /** escuridão nas bordas (alpha do preto) */
    strength: number;
    /** raio da área central 100% limpa, em % */
    center: number;
    /** 0 = transição curta/abrupta · 1 = transição até os cantos (bem gradual) */
    softness: number;
  };
  warmGlow: GlowConfig;
  redGlow: GlowConfig;
  haze: GlowConfig;
  beams: {
    enabled: boolean;
    color: string;
    opacity: number;
    items: readonly BeamConfig[];
  };
  particles: {
    enabled: boolean;
    count: number;
    /** quantas continuam visíveis em telas ≤ 767px */
    mobileCount: number;
    /** diâmetro, em px — a maioria sai perto do mínimo, poucas perto do máximo */
    size: Range;
    /** as maiores recebem a menor opacidade (bokeh distante), as menores a maior (poeira) */
    opacity: Range;
    /** desfoque: 0 = ponto nítido · 1 = só halo */
    blur: number;
    colors: readonly string[];
    /** "edges" = deixa o centro da tela livre · "uniform" = espalha por toda a tela */
    distribution: "edges" | "uniform";
    /** troque o número para sortear outra distribuição */
    seed: number;
  };
  /** ajustes em telas ≤ 767px (multiplicadores) */
  mobile: { intensity: number; glowScale: number };
  /** movimento ambiente contínuo (desligado por padrão) — ver animations/atmosphereDrift.ts */
  drift: AtmosphereDriftParams;
};

/** Preset base: o visual padrão do site. Os outros presets só descrevem o que muda. */
const cinematic: AtmosphereConfig = {
  intensity: 5,
  base: { center: "#16161b", edge: "#0b0b0e" },
  texture: {
    enabled: true,
    src: textureImage.src,
    opacity: 0.35,
    size: "cover",
    blendMode: "luminosity",
  },
  grain: { opacity: 0.032, size: 180, frequency: 0.85 },
  vignette: { strength: 0.55, center: 35, softness: 0.9 },
  warmGlow: {
    color: "#c7782e",
    x: 90,
    y: 4,
    size: 62,
    ratio: 1.25,
    opacity: 0.15,
    softness: 0.7,
  },
  redGlow: {
    color: "#7a1a2c",
    x: 6,
    y: 94,
    size: 72,
    ratio: 1.15,
    opacity: 0.24,
    softness: 0.75,
  },
  haze: {
    color: "#e2b48a",
    x: 50,
    y: -10,
    size: 110,
    ratio: 2.4,
    opacity: 0.045,
    softness: 1,
  },
  beams: {
    enabled: false,
    color: "#f1c48f",
    opacity: 0.05,
    items: [
      { x: 78, y: -8, angle: -22, spread: 14, length: 85, opacity: 1 },
      { x: 24, y: -8, angle: 18, spread: 10, length: 70, opacity: 0.7 },
    ],
  },
  particles: {
    enabled: true,
    count: 14,
    mobileCount: 6,
    size: [1.5, 16],
    opacity: [0.07, 0.32],
    blur: 0.6,
    colors: ["#f0b673", "#e8a05a", "#f5d2a8", "#b8465a"],
    distribution: "edges",
    seed: 7,
  },
  mobile: { intensity: 0.85, glowScale: 0.8 },
  drift: {
    enabled: false,
    glowDistance: 40,
    glowDuration: 16,
    particleDistance: 24,
    particleDuration: 10,
    mobileFactor: 0.5,
  },
};

export const ATMOSPHERE_PRESETS = {
  /** Quase imperceptível: só tira o "chapado" do fundo. */
  subtle: mergeAtmosphere(cinematic, {
    grain: { opacity: 0.025 },
    vignette: { strength: 0.4 },
    warmGlow: { opacity: 0.09 },
    redGlow: { opacity: 0.14 },
    haze: { opacity: 0.025 },
    particles: { count: 8, mobileCount: 4, opacity: [0.05, 0.2] },
  }),

  /** Padrão do site: palco à noite, discreto. */
  cinematic,

  /** Mais show: luzes mais presentes, feixes ligados e mais poeira no ar. */
  stage: mergeAtmosphere(cinematic, {
    grain: { opacity: 0.04 },
    vignette: { strength: 0.65 },
    warmGlow: { opacity: 0.22, size: 70 },
    redGlow: { opacity: 0.32, size: 78 },
    haze: { opacity: 0.07 },
    beams: { enabled: true, opacity: 0.07 },
    particles: { count: 22, mobileCount: 9, opacity: [0.08, 0.4] },
  }),
} satisfies Record<string, AtmosphereConfig>;

export type AtmospherePresetName = keyof typeof ATMOSPHERE_PRESETS;

/** Preset usado quando o componente não recebe `preset`. */
export const ATMOSPHERE_DEFAULT_PRESET: AtmospherePresetName = "cinematic";
