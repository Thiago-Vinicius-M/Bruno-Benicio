"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useCommercialAccess, useSellerCode, type CommercialState } from "./useWhatsAppReturn";

/**
 * Estado da versão comercial (link /p/<código>) compartilhado pela página: NOSSO SHOW
 * (valores e "Voltar ao WhatsApp"), o menu e a seção CONTATO. O provider consulta o
 * servidor uma vez só; fora dele (ex.: um componente renderizado sozinho), cada um consulta
 * por conta própria, com o mesmo resultado.
 */
export type Commercial = { sellerCode: string | null; access: CommercialState };

const CommercialContext = createContext<Commercial | null>(null);

export function CommercialProvider({ children }: { children: ReactNode }) {
  const sellerCode = useSellerCode();
  const access = useCommercialAccess(sellerCode);
  return <CommercialContext.Provider value={{ sellerCode, access }}>{children}</CommercialContext.Provider>;
}

export function useCommercial(): Commercial {
  const shared = useContext(CommercialContext);
  const sellerCode = useSellerCode();
  // Com provider, não consulta de novo (código null = nada a pedir ao servidor).
  const access = useCommercialAccess(shared ? null : sellerCode);
  return shared ?? { sellerCode, access };
}

/**
 * Na proposta comercial (link válido, ou ainda sendo conferido), o contato direto com a
 * dupla sai de cena: o caminho é o "Voltar ao WhatsApp" de quem enviou o link. Site público,
 * link expirado, desativado ou com erro → contatos normais.
 */
export const hidesDirectContact = ({ sellerCode, access }: Commercial) =>
  sellerCode !== null && (access.status === "commercial" || access.status === "loading");
