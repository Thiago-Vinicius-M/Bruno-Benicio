"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/animations/gsap";
import { createFadeSlide } from "@/animations/fadeSlide";
import { CONTACT_INSTAGRAM, CONTACT_PHONES, whatsappUrl } from "./contactContent";
import { CONTACT_REVEAL } from "./contactReveal";
import styles from "./Contact.module.css";

/**
 * Seção CONTATO: "Contrate agora!" com os telefones — cada um abre a conversa no WhatsApp
 * com a mensagem pronta (contactContent.ts) — e o Instagram.
 */
export function Contact() {
  const stageRef = useRef<HTMLDivElement>(null);

  // O stage é o trigger (não é animado); os alvos são marcados com data-reveal no JSX.
  useGSAP(
    () => {
      const stage = stageRef.current!;
      const { cta, ...params } = CONTACT_REVEAL;
      const mm = createFadeSlide(
        stage,
        [{ ...cta, targets: gsap.utils.toArray<HTMLElement>('[data-reveal="cta"]', stage) }],
        params,
      );
      return () => mm.revert();
    },
    { dependencies: [CONTACT_REVEAL], revertOnUpdate: true },
  );

  return (
    <section id="contato" className={styles.contact} aria-labelledby="contato-title">
      <div ref={stageRef} className={`container ${styles.stage}`}>
        <h2 id="contato-title" className={`type-editorial ${styles.title}`} data-reveal="cta">
          Contrate agora!
        </h2>
        <ul className={styles.phones} aria-label="WhatsApp para contratar" data-reveal="cta">
          {CONTACT_PHONES.map((phone) => (
            <li key={phone.number}>
              <a href={whatsappUrl(phone.number)} target="_blank" rel="noopener noreferrer" className={styles.phone}>
                {phone.display}
                <span className={styles.srOnly}> (WhatsApp, abre em nova aba)</span>
              </a>
            </li>
          ))}
        </ul>
        <a
          href={CONTACT_INSTAGRAM.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`type-nav ${styles.instagram}`}
          data-reveal="cta"
        >
          {CONTACT_INSTAGRAM.handle}
          <span className={styles.srOnly}> (Instagram, abre em nova aba)</span>
        </a>
      </div>
    </section>
  );
}
