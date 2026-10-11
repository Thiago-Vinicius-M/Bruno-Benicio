"use client";

import { useRef, type ReactNode } from "react";
import { gsap, useGSAP } from "@/animations/gsap";
import { createFadeSlide } from "@/animations/fadeSlide";
import { formatPrice } from "@/lib/showModels/price";
import type { CommercialShowModel, PublicShowModel, ShowModelsState } from "@/lib/showModels/types";
import { SHOW_INCLUDES, SHOW_REPERTOIRE } from "./showContent";
import { SHOW_REVEAL } from "./showReveal";
import { useCommercialAccess, useSellerCode, useWhatsAppReturn, type CommercialState } from "./useWhatsAppReturn";
import { WhatsAppReturn } from "./WhatsAppReturn";
import styles from "./Show.module.css";

type RevealGroup = "heading" | "packages" | "details";

/** Aviso da versão comercial quando ela não pôde ser liberada (os valores não aparecem). */
function commercialNotice(access: CommercialState): string | null {
  if (access.status === "inactive") {
    return "Este link de atendimento não está mais ativo. Fale com a gente pelos contatos abaixo.";
  }
  if (access.status === "error") {
    return "Não foi possível carregar os valores agora. Atualize a página ou fale com a gente pelos contatos abaixo.";
  }
  return null;
}

/**
 * Seção NOSSO SHOW: formatos de show (cadastrados no painel, carregados em app/page.tsx),
 * repertório e estrutura (showContent.ts). Mesma tipografia, cores e divisórias da seção
 * MÚSICAS; entrada com o mesmo fade + slide.
 *
 * Duas versões:
 *   pública   → nome, duração e descrição. A página estática não contém valores.
 *   comercial → quem chegou por um link de vendedor (/r/<código>) recebe do servidor,
 *               depois de o código ser conferido no banco, os valores e a escolha do
 *               formato, com data/horário opcionais e o "Voltar ao WhatsApp" desse vendedor.
 */
export function Show({ models }: { models: ShowModelsState }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const sellerCode = useSellerCode();
  const access = useCommercialAccess(sellerCode);
  const whatsapp = useWhatsAppReturn();

  const commercial = access.status === "commercial";
  const list: (PublicShowModel | CommercialShowModel)[] = commercial
    ? access.models
    : models.status === "ready"
      ? models.models
      : [];
  const selectable = commercial && list.length > 0;
  const notice = commercialNotice(access);
  // Recria a entrada só se os cards mudarem (ex.: versão comercial com outro conjunto).
  const listKey = list.map((item) => item.id).join(",");

  // O stage é o trigger (não é animado); os alvos são marcados com data-reveal no JSX.
  useGSAP(
    () => {
      const stage = stageRef.current!;
      const group = (name: RevealGroup) => gsap.utils.toArray<HTMLElement>(`[data-reveal="${name}"]`, stage);

      const { heading, packages, details, ...params } = SHOW_REVEAL;
      const mm = createFadeSlide(
        stage,
        [
          { ...heading, targets: group("heading") },
          { ...packages, targets: group("packages") },
          { ...details, targets: group("details") },
        ],
        params,
      );
      return () => mm.revert();
    },
    { dependencies: [SHOW_REVEAL, listKey], revertOnUpdate: true },
  );

  const packageContent = (item: PublicShowModel | CommercialShowModel): ReactNode => (
    <>
      <div className={styles.packageInfo}>
        <h3 className={`type-caption ${styles.packageName}`}>{item.name}</h3>
        <p className={styles.duration}>{item.duration}</p>
        {item.description && <p className={styles.description}>{item.description}</p>}
      </div>
      {"price" in item && <p className={styles.price}>{formatPrice(item.price)}</p>}
    </>
  );

  return (
    <section id="nosso-show" className={styles.show} aria-labelledby="nosso-show-title">
      <div ref={stageRef} className={`container-narrow ${styles.stage}`}>
        <header className={styles.intro}>
          <h2 id="nosso-show-title" className="type-title" data-reveal="heading">
            NOSSO SHOW
          </h2>
          <p className={`type-nav ${styles.eyebrow}`} data-reveal="heading">
            Orçamento de shows
          </p>
        </header>

        {list.length > 0 ? (
          <div className={styles.choice}>
            {/* Formatos: nome + duração à esquerda; na versão comercial, preço à direita (estilo setlist). */}
            <ul className={styles.packages} aria-label="Formatos de show">
              {list.map((item) => {
                const isSelected = selectable && whatsapp.selected?.id === item.id;
                return (
                  <li
                    key={item.id}
                    className={styles.package}
                    data-reveal="packages"
                    data-selectable={selectable || undefined}
                    data-selected={isSelected || undefined}
                  >
                    {selectable && "price" in item ? (
                      <label className={styles.option}>
                        <input
                          type="radio"
                          name="nosso-show-formato"
                          value={item.id}
                          checked={isSelected}
                          onChange={() => whatsapp.select(item)}
                          className={styles.radio}
                        />
                        <span className={styles.radioMark} aria-hidden="true" />
                        {packageContent(item)}
                      </label>
                    ) : (
                      packageContent(item)
                    )}
                  </li>
                );
              })}
            </ul>

            {selectable && (
              <WhatsAppReturn
                selected={whatsapp.selected}
                date={whatsapp.date}
                time={whatsapp.time}
                state={whatsapp.state}
                onDateChange={whatsapp.setDate}
                onTimeChange={whatsapp.setTime}
                onRetry={whatsapp.retry}
              />
            )}
            {notice && (
              <p className={styles.whatsappStatus} data-tone="error" role="status">
                {notice}
              </p>
            )}
          </div>
        ) : (
          <p className={`type-body ${styles.unavailable}`} data-reveal="packages">
            {models.status === "error"
              ? "Não foi possível carregar os formatos de show agora. Fale com a gente pelos contatos abaixo."
              : "Consulte os formatos de show disponíveis pelos contatos abaixo."}
          </p>
        )}

        <div className={styles.details}>
          <div className={styles.detail} data-reveal="details">
            <h3 className={`type-nav ${styles.label}`}>Repertório</h3>
            <p className="type-body">{SHOW_REPERTOIRE.styles}</p>
            <p className={styles.note}>{SHOW_REPERTOIRE.note}</p>
          </div>
          <div className={styles.detail} data-reveal="details">
            <h3 className={`type-nav ${styles.label}`}>O show conta com</h3>
            <p className="type-body">{SHOW_INCLUDES}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
