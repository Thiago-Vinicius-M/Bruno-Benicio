"use client";

import { useImperativeHandle, useMemo, useRef, type CSSProperties, type Ref } from "react";
import { useGSAP } from "@/animations/gsap";
import { createAtmosphereDrift } from "@/animations/atmosphereDrift";
import {
  ATMOSPHERE_DEFAULT_PRESET,
  ATMOSPHERE_PRESETS,
  type AtmospherePresetName,
} from "./atmosphereConfig";
import {
  atmosphereVariables,
  beamStyle,
  createParticles,
  mergeAtmosphere,
  type AtmosphereOverrides,
} from "./atmosphereStyle";
import styles from "./AtmosphereBackground.module.css";

/**
 * Camadas animáveis da atmosfera. transform e opacity de cada uma estão livres para o GSAP
 * (o config fica nos elementos internos), então animar uma camada nunca apaga o visual.
 * texture/beams/particles são null quando desligados no config.
 */
export type AtmosphereLayers = {
  /** raiz — anime aqui as custom properties (ex.: "--atm-intensity-base") */
  root: HTMLDivElement;
  texture: HTMLDivElement | null;
  /** grupo de todas as luzes: opacity aqui = intensidade geral das luzes */
  lights: HTMLDivElement;
  haze: HTMLDivElement;
  warmGlow: HTMLDivElement;
  redGlow: HTMLDivElement;
  beams: HTMLDivElement | null;
  particles: HTMLDivElement | null;
  vignette: HTMLDivElement;
  grain: HTMLDivElement;
};

type AtmosphereBackgroundProps = {
  preset?: AtmospherePresetName;
  /** ajustes pontuais por cima do preset (só o que muda) */
  config?: AtmosphereOverrides;
  /** "viewport" = fixa atrás da página inteira · "container" = cobre só o elemento pai */
  scope?: "viewport" | "container";
  ref?: Ref<AtmosphereLayers>;
};

export function AtmosphereBackground({
  preset = ATMOSPHERE_DEFAULT_PRESET,
  config: overrides,
  scope = "viewport",
  ref,
}: AtmosphereBackgroundProps) {
  const config = useMemo(() => mergeAtmosphere(ATMOSPHERE_PRESETS[preset], overrides), [preset, overrides]);
  const particles = useMemo(() => createParticles(config.particles), [config.particles]);

  const rootRef = useRef<HTMLDivElement>(null);
  const textureRef = useRef<HTMLDivElement>(null);
  const lightsRef = useRef<HTMLDivElement>(null);
  const hazeRef = useRef<HTMLDivElement>(null);
  const warmGlowRef = useRef<HTMLDivElement>(null);
  const redGlowRef = useRef<HTMLDivElement>(null);
  const beamsRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);
  // formas internas: alvos da deriva ambiente (não disputam transform com as camadas)
  const warmShapeRef = useRef<HTMLDivElement>(null);
  const redShapeRef = useRef<HTMLDivElement>(null);

  // Sem lista de dependências: recriado a cada render, então beams/particles refletem o
  // config atual (os elementos somem quando desligados).
  useImperativeHandle(ref, () => ({
    root: rootRef.current!,
    texture: textureRef.current,
    lights: lightsRef.current!,
    haze: hazeRef.current!,
    warmGlow: warmGlowRef.current!,
    redGlow: redGlowRef.current!,
    beams: beamsRef.current,
    particles: particlesRef.current,
    vignette: vignetteRef.current!,
    grain: grainRef.current!,
  }));

  // Deriva ambiente (config.drift, desligada por padrão). config como dependência: ao editar
  // o config no `next dev`, o efeito é revertido e recriado com os novos valores.
  useGSAP(
    () => {
      const mm = createAtmosphereDrift(
        {
          glows: [warmShapeRef.current!, redShapeRef.current!],
          particles: Array.from(particlesRef.current?.children ?? []) as HTMLElement[],
        },
        config.drift,
      );
      return () => mm.revert();
    },
    { dependencies: [config], revertOnUpdate: true },
  );

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${styles[scope]}`}
      style={atmosphereVariables(config)}
      data-atmosphere=""
      aria-hidden="true"
    >
      <div className={styles.base} />

      {config.texture.enabled && (
        <div ref={textureRef} className={styles.texture} data-atmosphere-layer="texture" />
      )}

      <div ref={lightsRef} className={styles.layer} data-atmosphere-layer="lights">
        <div ref={hazeRef} className={styles.layer} data-atmosphere-layer="haze">
          <div className={`${styles.glow} ${styles.haze}`} />
        </div>

        <div ref={redGlowRef} className={styles.layer} data-atmosphere-layer="red-glow">
          <div ref={redShapeRef} className={`${styles.glow} ${styles.red}`} />
        </div>

        <div ref={warmGlowRef} className={styles.layer} data-atmosphere-layer="warm-glow">
          <div ref={warmShapeRef} className={`${styles.glow} ${styles.warm}`} />
        </div>

        {config.beams.enabled && (
          <div ref={beamsRef} className={styles.layer} data-atmosphere-layer="beams">
            {config.beams.items.map((beam, i) => (
              <div key={i} className={styles.beam} style={beamStyle(beam, config.beams)} />
            ))}
          </div>
        )}

        {config.particles.enabled && (
          <div ref={particlesRef} className={styles.layer} data-atmosphere-layer="particles">
            {particles.map((p, i) => (
              <span
                key={i}
                className={styles.particle}
                data-desktop-only={p.desktopOnly || undefined}
                style={
                  {
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    width: p.size,
                    height: p.size,
                    "--rgb": p.rgb,
                    "--opacity": p.opacity,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        )}
      </div>

      <div ref={vignetteRef} className={styles.vignette} data-atmosphere-layer="vignette" />
      <div ref={grainRef} className={styles.grain} data-atmosphere-layer="grain" />
    </div>
  );
}

/**
 * Camadas da atmosfera fixa da página, para animá-las de QUALQUER componente (ex.: um
 * ScrollTrigger dentro de uma seção), já que ela é montada no layout e não na seção.
 * Chame só no navegador (dentro de useGSAP). Retorna null se não houver atmosfera montada.
 */
export function getAtmosphereLayers(root: ParentNode = document): AtmosphereLayers | null {
  const el = root.querySelector<HTMLDivElement>("[data-atmosphere]");
  if (!el) return null;
  const layer = (name: string) => el.querySelector<HTMLDivElement>(`[data-atmosphere-layer="${name}"]`);
  return {
    root: el,
    texture: layer("texture"),
    lights: layer("lights")!,
    haze: layer("haze")!,
    warmGlow: layer("warm-glow")!,
    redGlow: layer("red-glow")!,
    beams: layer("beams"),
    particles: layer("particles"),
    vignette: layer("vignette")!,
    grain: layer("grain")!,
  };
}
