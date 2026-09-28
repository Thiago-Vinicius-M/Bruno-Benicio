/**
 * Converte o config da atmosfera em estilos — funções puras, sem DOM e sem React.
 *
 * Tudo o que depende do config vira custom property (--atm-*) no elemento raiz; o CSS
 * module só lê essas variáveis. Assim o CSS não tem números "mágicos" e o config continua
 * sendo a única fonte dos valores.
 *
 * As partículas são sorteadas com um gerador pseudoaleatório com seed: o servidor e o
 * navegador produzem exatamente as mesmas posições (sem erro de hidratação) e a
 * distribuição só muda quando a seed muda.
 */
import type { CSSProperties } from "react";
import type { AtmosphereConfig, BeamConfig, GlowConfig } from "./atmosphereConfig";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type AtmosphereOverrides = DeepPartial<AtmosphereConfig>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Copia `base` aplicando só o que `overrides` define (objetos são mesclados; listas, trocadas). */
export function mergeAtmosphere(base: AtmosphereConfig, overrides?: AtmosphereOverrides): AtmosphereConfig {
  const merge = (a: Record<string, unknown>, b: Record<string, unknown>) => {
    const out: Record<string, unknown> = { ...a };
    for (const [key, value] of Object.entries(b)) {
      if (value === undefined) continue;
      out[key] = isObject(value) && isObject(a[key]) ? merge(a[key], value) : value;
    }
    return out;
  };
  return overrides ? (merge(base, overrides) as AtmosphereConfig) : base;
}

/** "#c7782e" → "199 120 46" (formato usado em rgb(var(--x) / alpha)). */
function rgb(hex: string) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? [...value].map((c) => c + c).join("") : value;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const round = (n: number) => Math.round(n * 100) / 100;

function glowVariables(prefix: string, glow: GlowConfig) {
  return {
    [`--atm-${prefix}-rgb`]: rgb(glow.color),
    [`--atm-${prefix}-x`]: `${glow.x}%`,
    [`--atm-${prefix}-y`]: `${glow.y}%`,
    [`--atm-${prefix}-size`]: `${glow.size}vmax`,
    [`--atm-${prefix}-ratio`]: glow.ratio,
    [`--atm-${prefix}-opacity`]: glow.opacity,
    // parada intermediária do degradê: quanto menor, mais cedo a luz começa a decair
    [`--atm-${prefix}-mid`]: `${round((1 - glow.softness) * 50)}%`,
  };
}

/**
 * Ruído procedural (feTurbulence) num SVG pequeno, repetido em ladrilho. O navegador
 * rasteriza uma única vez: não há arquivo de imagem nem custo por frame.
 */
function grainImage({ size, frequency }: AtmosphereConfig["grain"]) {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>` +
    `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='2' stitchTiles='stitch'/>` +
    `<feColorMatrix type='saturate' values='0'/></filter>` +
    `<rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Vinheta: centro transparente → preto nas bordas, com uma parada extra para suavizar a curva. */
function vignetteImage({ strength, center, softness }: AtmosphereConfig["vignette"]) {
  const end = center + (100 - center) * softness;
  const mid = center + (end - center) * 0.55;
  return (
    `radial-gradient(ellipse farthest-corner at 50% 50%, rgb(0 0 0 / 0) ${round(center)}%, ` +
    `rgb(0 0 0 / ${round(strength * 0.35)}) ${round(mid)}%, rgb(0 0 0 / ${strength}) ${round(end)}%)`
  );
}

export function atmosphereVariables(config: AtmosphereConfig) {
  return {
    "--atm-intensity-base": config.intensity,
    "--atm-mobile-intensity": config.mobile.intensity,
    "--atm-mobile-glow-scale": config.mobile.glowScale,
    "--atm-base-center": config.base.center,
    "--atm-base-edge": config.base.edge,
    "--atm-texture-image": `url("${config.texture.src}")`,
    "--atm-texture-opacity": config.texture.opacity,
    "--atm-texture-size": config.texture.size,
    "--atm-texture-blend": config.texture.blendMode,
    "--atm-grain-opacity": config.grain.opacity,
    "--atm-grain-size": `${config.grain.size}px`,
    "--atm-grain-image": grainImage(config.grain),
    "--atm-vignette-image": vignetteImage(config.vignette),
    "--atm-particle-core": `${round((1 - config.particles.blur) * 60)}%`,
    ...glowVariables("warm", config.warmGlow),
    ...glowVariables("red", config.redGlow),
    ...glowVariables("haze", config.haze),
  } as CSSProperties;
}

/**
 * Feixe = cone (conic-gradient) saindo da origem, apagado pela distância (mask radial).
 * No conic-gradient 0deg aponta para cima e o ângulo cresce no sentido horário, então
 * 180deg aponta para baixo e subtrair o ângulo inclina o feixe para a direita.
 */
export function beamStyle(beam: BeamConfig, beams: AtmosphereConfig["beams"]) {
  const c = rgb(beams.color);
  const s = beam.spread;
  const origin = `${beam.x}% ${beam.y}%`;
  return {
    "--atm-beam-opacity": round(beam.opacity * beams.opacity),
    backgroundImage:
      `conic-gradient(from ${180 - beam.angle - s / 2}deg at ${origin}, rgb(${c} / 0) 0deg, ` +
      `rgb(${c} / 0.55) ${round(s * 0.3)}deg, rgb(${c} / 1) ${round(s / 2)}deg, ` +
      `rgb(${c} / 0.55) ${round(s * 0.7)}deg, rgb(${c} / 0) ${s}deg)`,
    maskImage: `radial-gradient(circle at ${origin}, #000 0%, rgb(0 0 0 / 0.4) ${round(beam.length * 0.5)}%, transparent ${beam.length}%)`,
  } as CSSProperties;
}

/** Gerador pseudoaleatório determinístico (mulberry32). */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Particle = {
  x: number;
  y: number;
  size: number;
  opacity: number;
  rgb: string;
  /** além do mobileCount: escondida em telas ≤ 767px */
  desktopOnly: boolean;
};

export function createParticles(particles: AtmosphereConfig["particles"]): Particle[] {
  const rand = random(particles.seed);
  const [minSize, maxSize] = particles.size;
  const [minOpacity, maxOpacity] = particles.opacity;
  const list: Particle[] = [];

  for (let attempt = 0; list.length < particles.count && attempt < particles.count * 50; attempt++) {
    const x = rand() * 100;
    const y = rand() * 100;
    // "edges": descarta pontos dentro de uma elipse central (onde fica o conteúdo)
    if (particles.distribution === "edges" && ((x - 50) / 50) ** 2 + ((y - 50) / 50) ** 2 < 0.35) continue;

    const t = rand() ** 3; // ao cubo: a maioria pequena, poucas grandes
    list.push({
      x: round(x),
      y: round(y),
      size: round(minSize + (maxSize - minSize) * t),
      opacity: round((maxOpacity - (maxOpacity - minOpacity) * t) * (0.75 + rand() * 0.25)),
      rgb: rgb(particles.colors[Math.floor(rand() * particles.colors.length)]),
      desktopOnly: list.length >= particles.mobileCount,
    });
  }
  return list;
}
