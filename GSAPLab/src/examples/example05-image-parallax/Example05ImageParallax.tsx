import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { AnimationSection } from "../../components/AnimationSection";
import { Meter, Readout, type MeterHandle, type ReadoutHandle } from "../../components/Hud";
import { END_SUGGESTIONS, SCRUB_OPTIONS, START_SUGGESTIONS } from "../../lab/options";
import type { Control, ExampleProps } from "../../lab/types";
import { useLabParams } from "../../lab/useLabParams";
import {
  createImageParallax,
  PARALLAX_DEFAULTS,
  parallaxGeometry,
  type ParallaxGeometry,
  type ParallaxParams,
} from "./animation";
import source from "./animation.ts?raw";
import "./styles.css";

const CONTROLS: Control<ParallaxParams>[] = [
  { type: "text", key: "start", label: "start", group: "scrollTrigger", suggestions: START_SUGGESTIONS },
  { type: "text", key: "end", label: "end", group: "scrollTrigger", suggestions: END_SUGGESTIONS },
  { type: "select", key: "scrub", label: "scrub", group: "scrollTrigger", options: SCRUB_OPTIONS },
  {
    type: "range",
    key: "intensity",
    label: "intensidade (|yPercent|)",
    group: "tween",
    min: 0,
    max: 100,
    step: 5,
    unit: "%",
    hint: "Teste 20, 50 e 100. É % da altura da PRÓPRIA imagem.",
  },
  {
    type: "select",
    key: "direction",
    label: "direção",
    group: "tween",
    options: [
      { label: "up — yPercent negativo (mais rápida)", value: "up" },
      { label: "down — yPercent positivo (mais lenta)", value: "down" },
    ],
  },
  {
    type: "toggle",
    key: "compensate",
    label: "compensar altura",
    group: "layout",
    hint: "altura = 1 ÷ (1 − intensidade). Desligue para ver o “buraco”.",
  },
  { type: "toggle", key: "markers", label: "markers", group: "debug" },
];

function toSnippet(p: ParallaxParams) {
  const geo = parallaxGeometry(p.intensity, p.direction, p.compensate);
  return `// layout (não anima): altura calculada p/ não sobrar buraco
gsap.set(image, { height: "${(geo.heightRatio * 100).toFixed(1)}%" });

gsap.fromTo(image,
  { yPercent: 0 },
  {
    yPercent: ${geo.yPercent},        // mobile: ${(geo.yPercent * 0.6).toFixed(0)}
    ease: "none",
    scrollTrigger: {
      trigger: frame,        // moldura com overflow: hidden
      start: "${p.start}",
      end: "${p.end}",
      scrub: ${p.scrub},
      markers: ${p.markers},
    },
  },
);`;
}

/** Diagrama lateral: moldura (branco) × imagem (cor) em progress 0 e 1 */
function GeometryDiagram({ geo }: { geo: ParallaxGeometry }) {
  const H = geo.heightRatio;
  const yMin = Math.min(geo.topStart, geo.topEnd, 0) - 0.15;
  const yMax = Math.max(geo.topStart + H, geo.topEnd + H, 1) + 0.15;
  const range = yMax - yMin;
  const height = 190;
  const unit = height / range; // px por "altura da moldura"
  const frameW = 56;
  const y = (v: number) => (v - yMin) * unit;

  const state = (label: string, top: number, x: number, gap: number) => (
    <g transform={`translate(${x} 0)`}>
      <rect x={0} y={y(top)} width={frameW} height={H * unit} className="px-diag__img" />
      <rect x={0} y={y(0)} width={frameW} height={unit} className="px-diag__frame" />
      {gap > 0.001 && (
        <rect
          x={0}
          y={top > 0 ? y(0) : y(top + H)}
          width={frameW}
          height={gap * unit}
          className="px-diag__gap"
        />
      )}
      <text x={frameW / 2} y={height + 16} textAnchor="middle" className="px-diag__label">
        {label}
      </text>
    </g>
  );

  return (
    <svg className="px-diag" viewBox={`0 0 170 ${height + 22}`} role="img" aria-label="Moldura e imagem no início e no fim do scroll">
      {state("progress 0", geo.topStart, 10, 0)}
      {state("progress 1", geo.topEnd, 104, geo.gapEnd)}
    </svg>
  );
}

export function Example05ImageParallax({ meta }: ExampleProps) {
  const lab = useLabParams(PARALLAX_DEFAULTS);
  const { params } = lab;

  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const progressMeter = useRef<MeterHandle>(null);
  const yOut = useRef<ReadoutHandle>(null);
  const [geo, setGeo] = useState<{ geometry: ParallaxGeometry; intensity: number } | null>(null);

  useGSAP(
    () => {
      const mm = createImageParallax({ frame: frameRef.current!, image: imageRef.current! }, params, {
        onGeometry: (geometry, intensity) => setGeo({ geometry, intensity }),
        onUpdate: (progress, yPercent) => {
          progressMeter.current?.set(progress);
          yOut.current?.set(`${yPercent.toFixed(1)}%`);
        },
      });
      return () => mm.revert();
    },
    { dependencies: [params, lab.runId], revertOnUpdate: true },
  );

  const current = geo?.geometry ?? parallaxGeometry(params.intensity, params.direction, params.compensate);

  return (
    <AnimationSection
      meta={meta}
      lab={lab}
      controls={CONTROLS}
      snippet={toSnippet(params)}
      source={source}
      summary={[
        ["yPercent", String(current.yPercent)],
        ["altura", `${(current.heightRatio * 100).toFixed(0)}%`],
        ["start", params.start],
        ["end", params.end],
      ]}
    >
      <div className="px-stage wrap">
        <div className="px-main">
          <p className="px-flow">
            ↓ Este texto é conteúdo normal: sobe na velocidade da página. Observe a foto abaixo em relação a ele.
          </p>

          <div className="px-frame is-trigger" ref={frameRef} data-label="trigger · moldura (overflow: hidden)">
            <img
              ref={imageRef}
              className="px-img"
              src="/media/images/parallax-hills.webp"
              alt="Colinas verdes e penhascos sob neblina, com uma estrada estreita serpenteando no vale."
              width={1920}
              height={1920}
              loading="lazy"
              decoding="async"
            />
            <div className="px-fore">
              <p className="px-fore__title">Parallax</p>
              <p className="px-fore__note">este título anda junto com a página</p>
            </div>
          </div>

          <p className="px-flow">
            ↑ Mais conteúdo normal. A diferença de velocidade entre a foto e este texto é o parallax.
          </p>
        </div>

        <aside className="px-aside">
          <div className="hud">
            <span className="hud__title">ao vivo</span>
            <Meter label="progress" ref={progressMeter} />
            <Readout label="yPercent atual" ref={yOut} />
            <Readout label="intensidade efetiva" initial={geo ? `${geo.intensity.toFixed(0)}%` : "—"} />
          </div>

          <div className="hud px-geo">
            <span className="hud__title">geometria (em alturas da moldura)</span>
            <GeometryDiagram geo={current} />
            <Readout label="altura da imagem" initial={`${(current.heightRatio * 100).toFixed(0)}%`} />
            <Readout
              label="deslocamento final"
              initial={`${((current.yPercent / 100) * current.heightRatio * 100).toFixed(0)}% da moldura`}
            />
            <p className={current.gapEnd > 0.001 ? "px-geo__warn" : "px-geo__ok"}>
              {current.gapEnd > 0.001
                ? `Buraco no fim: ${(current.gapEnd * 100).toFixed(0)}% da moldura fica sem imagem.`
                : "A imagem cobre a moldura do início ao fim."}
            </p>
          </div>
        </aside>
      </div>
    </AnimationSection>
  );
}
