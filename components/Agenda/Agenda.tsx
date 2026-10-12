"use client";

import { Montserrat } from "next/font/google";
import {
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { createFadeSlide } from "@/animations/fadeSlide";
import { gsap, useGSAP } from "@/animations/gsap";
import { createPanelSwap } from "@/animations/panelSwap";
import { createParallax } from "@/animations/parallax";
import { agendaNow, type AgendaNow } from "@/lib/agenda/dates";
import { instagramProfileUrl } from "@/lib/agenda/instagram";
import type { PublicShow } from "@/lib/agenda/types";
import {
  formatShowDayMonth,
  formatShowTime,
  isPastShow,
  monthKey,
  monthLabel,
  showDateParts,
} from "@/lib/painel/showFormat";
import {
  AGENDA_PAGE_SIZE,
  AGENDA_PAGE_SWAP,
  AGENDA_PARALLAX,
  AGENDA_REVEAL,
  AGENDA_SWIPE_MIN,
} from "./agendaReveal";
import styles from "./Agenda.module.css";

/* Fonte das linhas da agenda (Figma), carregada só nesta seção. O título segue os demais (type-title). */
const montserrat = Montserrat({
  weight: "500",
  subsets: ["latin"],
  variable: "--font-agenda",
});

type RevealGroup = "heading" | "rows" | "controls";

/** "Agora" no fuso da banda, conferido a cada minuto: shows que já passaram saem sozinhos. */
const subscribeNow = (onChange: () => void) => {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
};
const nowKey = ({ date, time }: AgendaNow) => `${date} ${time}`;
const clientNow = () => nowKey(agendaNow());

const chunk = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );

type AgendaProps = {
  /** Shows do mês atual de hoje em diante (ver loadPublicAgenda). */
  shows: PublicShow[];
  /** "Agora" de quando a página foi gerada (servidor) — o mesmo na hidratação. */
  now: AgendaNow;
};

/**
 * Seção AGENDA: shows do mês atual que ainda vão acontecer, só com a agenda habilitada no
 * painel. Cada linha: dia da semana + data numa pílula laranja, local (e Instagram) no
 * centro e horário à direita.
 *
 * No máximo AGENDA_PAGE_SIZE shows por vez: passando disso, os seguintes ficam em páginas
 * que se trocam arrastando para o lado (dedo ou mouse), pelas bolinhas ou com ← →, como
 * no carrossel do SOBRE NÓS.
 *
 * A página do site é estática: o navegador confere o próprio "agora", então shows que já
 * passaram (e, na virada do mês, o mês anterior) saem antes da página ser regenerada.
 */
export function Agenda({ shows: loaded, now: generatedAt }: AgendaProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const [date, time] = useSyncExternalStore(subscribeNow, clientNow, () =>
    nowKey(generatedAt),
  ).split(" ");
  const shows = loaded.filter(
    (show) =>
      monthKey(show.show_date) === monthKey(date) &&
      !isPastShow(show, { date, time }),
  );
  const pages = chunk(shows, AGENDA_PAGE_SIZE);

  const [requested, setRequested] = useState(0);
  // Se shows saírem e a página pedida deixar de existir, fica na última.
  const index = Math.min(requested, Math.max(0, pages.length - 1));
  const previousRef = useRef(index);

  // Entrada da seção. O stage é o trigger (não é animado); os alvos têm data-reveal no JSX.
  useGSAP(
    () => {
      const stage = stageRef.current!;
      const group = (name: RevealGroup) =>
        gsap.utils.toArray<HTMLElement>(`[data-reveal="${name}"]`, stage);

      const { heading, rows, controls, ...params } = AGENDA_REVEAL;
      const mm = createFadeSlide(
        stage,
        [
          { ...heading, targets: group("heading") },
          { ...rows, targets: group("rows") },
          { ...controls, targets: group("controls") },
        ],
        params,
      );
      return () => mm.revert();
    },
    { dependencies: [AGENDA_REVEAL], revertOnUpdate: true },
  );

  // Parallax ao rolar (nos dois sentidos): título e lista em velocidades diferentes. São os
  // contêineres que andam — a entrada anima os elementos dentro deles, sem conflito.
  useGSAP(
    () => {
      const mm = createParallax(
        stageRef.current!,
        [
          { element: headRef.current!, ...AGENDA_PARALLAX.heading },
          { element: bodyRef.current!, ...AGENDA_PARALLAX.list },
        ],
        AGENDA_PARALLAX,
      );
      return () => mm.revert();
    },
    { dependencies: [AGENDA_PARALLAX], revertOnUpdate: true },
  );

  // Troca de página, como no SOBRE NÓS: uma troca nova cancela a anterior.
  useGSAP(
    () => {
      const previous = previousRef.current;
      previousRef.current = index;
      const panels = pagesRef.current?.children;
      if (previous === index || !panels?.[previous] || !panels[index]) return;
      const mm = createPanelSwap(
        panels[previous] as HTMLElement,
        panels[index] as HTMLElement,
        index > previous ? 1 : -1,
        AGENDA_PAGE_SWAP,
      );
      return () => mm.revert();
    },
    { dependencies: [index, AGENDA_PAGE_SWAP], revertOnUpdate: true },
  );

  const go = (next: number) =>
    setRequested(Math.min(pages.length - 1, Math.max(0, next)));

  // Arraste: decide no fim do gesto (horizontal e longo o bastante). touch-action: pan-y
  // no CSS mantém a rolagem vertical da página com o dedo.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Link do Instagram: clique normal, sem virar arraste.
    if ((event.target as HTMLElement).closest("a")) return;
    dragRef.current = { x: event.clientX, y: event.clientY };
    if (event.pointerType === "mouse")
      event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    dragRef.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < AGENDA_SWIPE_MIN || Math.abs(dx) < Math.abs(dy)) return;
    go(index + (dx < 0 ? 1 : -1));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = Math.min(pages.length - 1, Math.max(0, index + step));
    setRequested(next);
    dotsRef.current[next]?.focus();
  };

  const paged = pages.length > 1;

  return (
    <section
      id="agenda"
      className={`${montserrat.variable} ${styles.agenda}`}
      aria-labelledby="agenda-title"
    >
      <div ref={stageRef} className={`container-narrow ${styles.stage}`}>
        <header ref={headRef}>
          <h2 id="agenda-title" className="type-title" data-reveal="heading">
            AGENDA
          </h2>
          {/* Mês atual pelo relógio do navegador: na virada do mês muda sozinho. */}
          <p className={`type-caption ${styles.month}`} data-reveal="heading">
            {monthLabel(monthKey(date))}
          </p>
        </header>

        <div ref={bodyRef}>
          {pages.length === 0 ? (
            <p className={styles.empty} data-reveal="rows">
              Em breve, novas datas.
            </p>
          ) : (
            <div
              className={styles.carousel}
              data-paged={paged || undefined}
              role={paged ? "region" : undefined}
              aria-roledescription={paged ? "carrossel" : undefined}
              aria-label={paged ? "Próximos shows" : undefined}
              onKeyDown={paged ? onKeyDown : undefined}
            >
              <div
                ref={pagesRef}
                className={styles.pages}
                data-paged={paged || undefined}
                onPointerDown={paged ? onPointerDown : undefined}
                onPointerUp={paged ? onPointerUp : undefined}
                onPointerCancel={() => (dragRef.current = null)}
                aria-live={paged ? "polite" : undefined}
              >
                {pages.map((page, i) => (
                  <ul
                    key={page[0].id}
                    className={styles.list}
                    data-active={i === index || undefined}
                    aria-hidden={i !== index || undefined}
                  >
                    {page.map((show) => (
                      <AgendaRow key={show.id} show={show} reveal={i === 0} />
                    ))}
                  </ul>
                ))}
              </div>

              {/* Setas ‹ › nas laterais (só no desktop, CSS); desativadas na primeira/última página. */}
              {paged &&
                ([-1, 1] as const).map((step) => (
                  <button
                    key={step}
                    type="button"
                    className={styles.arrow}
                    data-side={step < 0 ? "prev" : "next"}
                    aria-label={
                      step < 0 ? "Shows anteriores" : "Próximos shows"
                    }
                    disabled={
                      step < 0 ? index === 0 : index === pages.length - 1
                    }
                    onClick={() => go(index + step)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d={step < 0 ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
                    </svg>
                  </button>
                ))}

              {/* Indicador ● ○ — também troca de página ao tocar. */}
              {paged && (
                <div className={styles.dots} data-reveal="controls">
                  {pages.map((page, i) => (
                    <button
                      key={page[0].id}
                      ref={(el) => {
                        dotsRef.current[i] = el;
                      }}
                      type="button"
                      className={styles.dot}
                      aria-label={`Shows ${i * AGENDA_PAGE_SIZE + 1} a ${i * AGENDA_PAGE_SIZE + page.length} de ${shows.length}`}
                      aria-current={i === index || undefined}
                      tabIndex={i === index ? 0 : -1}
                      onClick={() => go(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Uma linha da agenda. `reveal`: entra na animação de entrada (só a primeira página). */
function AgendaRow({ show, reveal }: { show: PublicShow; reveal: boolean }) {
  const { weekday } = showDateParts(show.show_date);
  const time = formatShowTime(show.show_time);
  return (
    <li className={styles.row} data-reveal={reveal ? "rows" : undefined}>
      <time className={styles.date} dateTime={show.show_date}>
        <span className={styles.weekday}>{weekday}</span>
        <span className={styles.day}>{formatShowDayMonth(show.show_date)}</span>
      </time>
      <div className={styles.venue}>
        <p>{show.venue_name}</p>
        {show.venue_instagram && (
          <a
            className={styles.instagram}
            href={instagramProfileUrl(show.venue_instagram)}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
          >
            @{show.venue_instagram}
          </a>
        )}
      </div>
      <time className={styles.time} dateTime={time}>
        {time}
      </time>
    </li>
  );
}
