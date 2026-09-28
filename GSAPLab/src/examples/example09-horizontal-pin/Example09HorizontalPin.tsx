import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { AnimationSection } from "../../components/AnimationSection";
import { Meter, Readout, type MeterHandle, type ReadoutHandle } from "../../components/Hud";
import { SCRUB_OPTIONS } from "../../lab/options";
import type { Control, ExampleProps } from "../../lab/types";
import { useLabParams } from "../../lab/useLabParams";
import { createHorizontalPin, HORIZONTAL_DEFAULTS, type HorizontalParams } from "./animation";
import source from "./animation.ts?raw";
import "./styles.css";

const CARDS = [
  {
    n: "01",
    title: "O scroll é vertical",
    text: "Você está rolando a página para baixo, normalmente. Nada de scroll-jacking.",
    img: "/media/images/card-snow.webp",
    alt: "Acampamento com barracas amarelas cobertas de neve, montanhas nevadas ao fundo.",
  },
  {
    n: "02",
    title: "O movimento é horizontal",
    text: "x = −progress × distância. A timeline converte scroll vertical em deslocamento horizontal.",
    img: "/media/images/card-waterfall.webp",
    alt: "Cachoeira alta caindo num vale verde cercado por pinheiros.",
  },
  {
    n: "03",
    title: "A distância é medida",
    text: "scrollWidth − clientWidth: exatamente o necessário para este card encostar na borda direita.",
    img: "/media/images/card-river.webp",
    alt: "Pessoa em pé numa pedra no meio de um rio, com floresta e neblina ao fundo.",
  },
];

const CONTROLS: Control<HorizontalParams>[] = [
  {
    type: "select",
    key: "mode",
    label: "cálculo do movimento",
    group: "timeline",
    options: [
      { label: "medido — x: −(scrollWidth − clientWidth)", value: "measured" },
      { label: "ingênuo — xPercent: −100 × (n − 1)", value: "xPercent" },
    ],
  },
  {
    type: "range",
    key: "speed",
    label: "end = distância ×",
    group: "scrollTrigger",
    min: 0.5,
    max: 3,
    step: 0.25,
    hint: "1 = 1px de scroll por 1px de movimento. 2 = o dobro de scroll.",
  },
  { type: "select", key: "scrub", label: "scrub", group: "scrollTrigger", options: SCRUB_OPTIONS },
  { type: "toggle", key: "markers", label: "markers", group: "debug" },
];

function toSnippet(p: HorizontalParams) {
  const move =
    p.mode === "measured"
      ? `tl.to(track, { x: () => -getDistance() }, 0);`
      : `tl.to(panels, { xPercent: -100 * (panels.length - 1) }, 0); // ✘ supõe painéis de 100%`;
  return `const getDistance = () => track.scrollWidth - section.clientWidth;

const tl = gsap.timeline({
  defaults: { ease: "none" },
  scrollTrigger: {
    trigger: section,
    pin: true,
    start: "top top",
    end: () => "+=" + getDistance() * ${p.speed},
    scrub: ${p.scrub},
    invalidateOnRefresh: true,
    anticipatePin: 1,
    markers: ${p.markers},
  },
});

${move}
tl.fromTo(progressBar, { scaleX: 0 }, { scaleX: 1 }, 0);`;
}

export function Example09HorizontalPin({ meta }: ExampleProps) {
  const lab = useLabParams(HORIZONTAL_DEFAULTS);
  const { params } = lab;

  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const progressMeter = useRef<MeterHandle>(null);
  const scrollWidthOut = useRef<ReadoutHandle>(null);
  const clientWidthOut = useRef<ReadoutHandle>(null);
  const distanceOut = useRef<ReadoutHandle>(null);
  const scrollOut = useRef<ReadoutHandle>(null);

  useGSAP(
    () => {
      const mm = createHorizontalPin(
        {
          section: sectionRef.current!,
          track: trackRef.current!,
          panels: gsap.utils.toArray<HTMLElement>(".hz-panel", trackRef.current),
          progressBar: barRef.current!,
        },
        params,
        {
          onProgress: (p) => progressMeter.current?.set(p),
          onMeasure: (m) => {
            scrollWidthOut.current?.set(`${m.scrollWidth}px`);
            clientWidthOut.current?.set(`${m.clientWidth}px`);
            distanceOut.current?.set(`${m.distance}px`);
            scrollOut.current?.set(`${Math.round(m.scrollDistance)}px`);
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
        ["modo", params.mode],
        ["end", `+= distância × ${params.speed}`],
        ["scrub", String(params.scrub)],
      ]}
    >
      {/* seção pinada (trigger). Só a fileira (track) e a barra são animadas. */}
      <div className="hz-section" ref={sectionRef}>
        <div className="hz-track" ref={trackRef}>
          <article className="hz-panel hz-panel--intro">
            <p className="kicker">pin + scrub + x</p>
            <h3 className="hz-intro__title">Continue rolando para baixo →</h3>
            <p className="hz-intro__text">
              A seção está pinada. Seu scroll vertical agora move esta fileira na horizontal.
            </p>
          </article>

          {CARDS.map((card) => (
            <article className="hz-panel hz-card" key={card.n}>
              <img src={card.img} alt={card.alt} width={1200} height={1500} loading="lazy" decoding="async" />
              <div className="hz-card__body">
                <span className="hz-card__n">CARD {card.n}</span>
                <h4 className="hz-card__title">{card.title}</h4>
                <p className="hz-card__text">{card.text}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="hz-footer">
          <span className="hz-progress" aria-hidden="true">
            <span className="hz-progress__fill" ref={barRef} />
          </span>
          <div className="hud hz-hud">
            <Meter label="progress" ref={progressMeter} />
            <Readout label="track.scrollWidth" ref={scrollWidthOut} />
            <Readout label="section.clientWidth" ref={clientWidthOut} />
            <Readout label="distância (x final)" ref={distanceOut} />
            <Readout label="end − start (scroll)" ref={scrollOut} />
          </div>
        </div>
      </div>
    </AnimationSection>
  );
}
