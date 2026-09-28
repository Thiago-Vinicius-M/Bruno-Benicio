import { gsap } from "gsap";
import { DEBUG_SCROLL } from "../config/debug";
import { MEDIA } from "../lib/media";
import type { LabExample } from "../lab/types";
import { useMediaQuery } from "../lab/useMediaQuery";

type Props = { examples: LabExample[] };

export function LabHeader({ examples }: Props) {
  const reduceMotion = useMediaQuery(MEDIA.reduceMotion);
  const isMobile = useMediaQuery(MEDIA.isMobile);
  const isTablet = useMediaQuery(MEDIA.isTablet);
  const breakpoint = isMobile ? "isMobile" : isTablet ? "isTablet" : "isDesktop";

  return (
    <header className="lab-header wrap">
      <div className="lab-header__top">
        <span>Laboratório de estudo</span>
        <span>
          gsap {gsap.version} · ScrollTrigger · React
        </span>
      </div>

      <h1 className="lab-header__title">
        GSAP <span>Scroll</span> Lab
      </h1>

      <p className="lab-header__lead">
        Uma página, {examples.length} experimentos. Cada seção isola uma técnica de ScrollTrigger — trigger, start/end,
        scrub, pin, timeline, stagger, snap — com o código visível e um painel de parâmetros para você mexer e ver o que
        muda.
      </p>

      <ul className="status" aria-label="Estado do laboratório">
        <li>
          <span className={`dot${DEBUG_SCROLL ? " is-on" : ""}`} />
          DEBUG_SCROLL = <strong>{String(DEBUG_SCROLL)}</strong>
        </li>
        <li>
          <span className={`dot${reduceMotion ? " is-warn" : " is-on"}`} />
          prefers-reduced-motion: <strong>{reduceMotion ? "reduce" : "no-preference"}</strong>
        </li>
        <li>
          <span className="dot is-on" />
          gsap.matchMedia → <strong>{breakpoint}</strong>
        </li>
      </ul>

      {reduceMotion && (
        <p className="notice">
          Seu sistema pede <strong>movimento reduzido</strong>. Os exemplos entram na versão estática (veja o ramo{" "}
          <code>reduceMotion</code> em cada <code>animation.ts</code>). Para estudar as animações, desative essa opção
          no sistema ou emule <code>prefers-reduced-motion: no-preference</code> no DevTools (Rendering).
        </p>
      )}

      <nav className="index-block" id="indice" aria-label="Exemplos">
        <div className="index-block__head">
          <h2>Índice</h2>
          <span className="muted">Abra “Parâmetros” no rodapé de cada seção para experimentar.</span>
        </div>
        <ol className="index">
          {examples.map(({ meta }) => (
            <li key={meta.number}>
              <a href={`#example-${meta.number}`}>
                <span className="index__num">{meta.number}</span>
                <span className="index__title">{meta.title}</span>
                <span className="index__concepts">{meta.concepts.slice(0, 4).join(" · ")}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <p className="scroll-hint">↓ Role para começar</p>
    </header>
  );
}
