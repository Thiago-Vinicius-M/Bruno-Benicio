import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { AnimationSection } from "../../components/AnimationSection";
import { Meter, Readout, type MeterHandle, type ReadoutHandle } from "../../components/Hud";
import { END_SUGGESTIONS, SCRUB_OPTIONS, START_SUGGESTIONS } from "../../lab/options";
import type { Control, ExampleProps } from "../../lab/types";
import { useLabParams } from "../../lab/useLabParams";
import { clipPaths, createImageReveal, IMAGE_REVEAL_DEFAULTS, type ImageRevealParams } from "./animation";
import source from "./animation.ts?raw";
import "./styles.css";

const CONTROLS: Control<ImageRevealParams>[] = [
  { type: "text", key: "start", label: "start", group: "scrollTrigger", suggestions: START_SUGGESTIONS },
  { type: "text", key: "end", label: "end", group: "scrollTrigger", suggestions: END_SUGGESTIONS },
  { type: "select", key: "scrub", label: "scrub", group: "scrollTrigger", options: SCRUB_OPTIONS },
  {
    type: "select",
    key: "shape",
    label: "forma do clip-path",
    group: "tween",
    options: [
      { label: "inset — do centro", value: "center" },
      { label: "inset — de baixo p/ cima", value: "bottom" },
      { label: "inset — da esquerda p/ direita", value: "left" },
      { label: "circle — círculo", value: "circle" },
    ],
  },
  { type: "range", key: "hidden", label: "% escondido no início", group: "tween", min: 0, max: 100, step: 5, unit: "%" },
  {
    type: "range",
    key: "radius",
    label: "round inicial",
    group: "tween",
    min: 0,
    max: 120,
    step: 4,
    unit: "px",
    disabled: (p) => p.shape === "circle",
  },
  { type: "range", key: "scaleFrom", label: "scale inicial (imagem)", group: "tween", min: 1, max: 2, step: 0.05 },
  {
    type: "select",
    key: "transformOrigin",
    label: "transformOrigin",
    group: "tween",
    options: ["center center", "top center", "bottom center", "left center", "right bottom"].map((v) => ({
      label: v,
      value: v,
    })),
    hint: "O ponto que fica parado enquanto a escala muda.",
  },
  { type: "toggle", key: "markers", label: "markers", group: "debug" },
];

function toSnippet(p: ImageRevealParams) {
  const clip = clipPaths(p);
  return `const tl = gsap.timeline({
  defaults: { ease: "none", duration: 1 },
  scrollTrigger: {
    trigger: figure,           // não anima
    start: "${p.start}",
    end: "${p.end}",
    scrub: ${p.scrub},
    markers: ${p.markers},
  },
});

tl.fromTo(clipBox,
    { clipPath: "${clip.from}" },
    { clipPath: "${clip.to}" }, 0)
  .fromTo(image,
    { scale: ${p.scaleFrom}, transformOrigin: "${p.transformOrigin}" },
    { scale: 1 }, 0)
  .fromTo(caption, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4 }, 0.6);`;
}

export function Example04ImageReveal({ meta }: ExampleProps) {
  const lab = useLabParams(IMAGE_REVEAL_DEFAULTS);
  const { params } = lab;

  const figureRef = useRef<HTMLElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const captionRef = useRef<HTMLElement>(null);
  const progressMeter = useRef<MeterHandle>(null);
  const clipOut = useRef<ReadoutHandle>(null);
  const scaleOut = useRef<ReadoutHandle>(null);

  useGSAP(
    () => {
      const mm = createImageReveal(
        { figure: figureRef.current!, clip: clipRef.current!, image: imageRef.current!, caption: captionRef.current! },
        params,
        {
          onUpdate: (progress, clipPath, scale) => {
            progressMeter.current?.set(progress);
            clipOut.current?.set(clipPath || "—");
            scaleOut.current?.set(scale.toFixed(3));
          },
        },
      );
      return () => mm.revert();
    },
    { dependencies: [params, lab.runId], revertOnUpdate: true },
  );

  return (
    <AnimationSection
      meta={meta}
      lab={lab}
      controls={CONTROLS}
      snippet={toSnippet(params)}
      source={source}
      summary={[
        ["clip", params.shape],
        ["scale", `${params.scaleFrom} → 1`],
        ["start", params.start],
        ["end", params.end],
        ["scrub", String(params.scrub)],
      ]}
    >
      <div className="rv-stage wrap">
        <figure className="rv-figure is-trigger" ref={figureRef} data-label="trigger · figure (não anima)">
          <div className="rv-clip" ref={clipRef}>
            <img
              ref={imageRef}
              className="rv-img"
              src="/media/images/reveal-fjord.webp"
              alt="Fiorde azul entre montanhas rochosas, visto do alto de um penhasco com pessoas na borda."
              width={1920}
              height={1200}
              loading="lazy"
              decoding="async"
            />
          </div>
          <figcaption className="rv-caption" ref={captionRef}>
            <span className="kicker">clip-path + scale</span>
            <span>O recorte é CSS; quem interpola os números é o GSAP.</span>
          </figcaption>
        </figure>

        <div className="rv-hud-wrap">
          <div className="hud rv-hud">
            <Meter label="progress" ref={progressMeter} />
            <Readout label="clipPath" ref={clipOut} />
            <Readout label="scale (imagem)" ref={scaleOut} />
          </div>
        </div>
      </div>
    </AnimationSection>
  );
}
