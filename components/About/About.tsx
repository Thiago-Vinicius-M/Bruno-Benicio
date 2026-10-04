"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Image from "next/image";
import { useGSAP } from "@/animations/gsap";
import { createPanelSwap } from "@/animations/panelSwap";
import { createParallax } from "@/animations/parallax";
import { ABOUT_SLIDES as SLIDES } from "./aboutContent";
import { ABOUT_PHOTO_SWAP, ABOUT_SWIPE_MIN, ABOUT_TEXT_SWAP } from "./aboutCarousel";
import { ABOUT_PARALLAX } from "./aboutParallax";
import styles from "./About.module.css";

const clamp = (i: number) => Math.min(SLIDES.length - 1, Math.max(0, i));

/**
 * SOBRE NÓS: carrossel de 3 slides (dupla · Bruno · Benício), foto + descrição.
 * Troca arrastando para o lado (dedo ou mouse), tocando nas bolinhas ou com ← → no
 * teclado. A descrição e a foto saem e entram animadas (animations/panelSwap.ts).
 */
export function About() {
  const [index, setIndex] = useState(0);
  const previousRef = useRef(index);
  const sliderRef = useRef<HTMLDivElement>(null);
  const photosRef = useRef<HTMLDivElement>(null);
  const textsRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  // O slider é o trigger do parallax (não é animado); fotos e textos são as camadas.
  useGSAP(
    () => {
      const mm = createParallax(
        sliderRef.current!,
        [
          { element: textsRef.current!, ...ABOUT_PARALLAX.text },
          { element: photosRef.current!, ...ABOUT_PARALLAX.photo },
        ],
        ABOUT_PARALLAX,
      );
      return () => mm.revert();
    },
    { dependencies: [ABOUT_PARALLAX], revertOnUpdate: true },
  );

  // Anima só as trocas. revertOnUpdate: uma troca nova cancela a anterior e o CSS
  // (slide ativo visível, os outros ocultos) volta a mandar antes de ela começar.
  useGSAP(
    () => {
      const previous = previousRef.current;
      previousRef.current = index;
      if (previous === index) return;
      const direction = index > previous ? 1 : -1;
      const photos = photosRef.current!.children;
      const texts = textsRef.current!.children;
      const mms = [
        createPanelSwap(texts[previous] as HTMLElement, texts[index] as HTMLElement, direction, ABOUT_TEXT_SWAP),
        createPanelSwap(photos[previous] as HTMLElement, photos[index] as HTMLElement, direction, ABOUT_PHOTO_SWAP),
      ];
      return () => mms.forEach((mm) => mm.revert());
    },
    { dependencies: [index, ABOUT_TEXT_SWAP, ABOUT_PHOTO_SWAP], revertOnUpdate: true },
  );

  const go = (next: number) => setIndex(clamp(next));

  // Arraste: decide no fim do gesto (horizontal e longo o bastante). touch-action: pan-y
  // no CSS mantém a rolagem vertical da página com o dedo.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragRef.current = { x: event.clientX, y: event.clientY };
    if (event.pointerType === "mouse") event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    dragRef.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < ABOUT_SWIPE_MIN || Math.abs(dx) < Math.abs(dy)) return;
    go(index + (dx < 0 ? 1 : -1));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = clamp(index + step);
    setIndex(next);
    dotsRef.current[next]?.focus();
  };

  return (
    <section id="sobre-nos" className={styles.about}>
      <h2 className="container type-title">SOBRE NÓS</h2>
      <div
        className={`container-wide ${styles.carousel}`}
        role="region"
        aria-roledescription="carrossel"
        aria-label="Sobre nós"
        onKeyDown={onKeyDown}
      >
        <div
          ref={sliderRef}
          className={styles.slider}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (dragRef.current = null)}
        >
          <div ref={photosRef} className={styles.photos}>
            {SLIDES.map((slide, i) => (
              <Image
                key={slide.id}
                src={slide.image}
                width={384}
                height={384}
                alt={slide.alt}
                draggable={false}
                className={styles.photo}
                data-active={i === index || undefined}
                aria-hidden={i !== index}
              />
            ))}
          </div>

          <div ref={textsRef} className={styles.texts} aria-live="polite">
            {SLIDES.map((slide, i) => (
              <div
                key={slide.id}
                className={styles.slide}
                data-active={i === index || undefined}
                aria-hidden={i !== index}
              >
                <h3 className={`type-caption ${styles.name}`}>{slide.name}</h3>
                <p className="type-body">{slide.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Indicador ● ○ ○ — também troca de slide ao tocar. */}
        <div className={styles.dots}>
          {SLIDES.map((slide, i) => (
            <button
              key={slide.id}
              ref={(el) => {
                dotsRef.current[i] = el;
              }}
              type="button"
              className={styles.dot}
              aria-label={`Descrição: ${slide.name}`}
              aria-current={i === index || undefined}
              tabIndex={i === index ? 0 : -1}
              onClick={() => go(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
