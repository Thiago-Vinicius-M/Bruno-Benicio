/**
 * Conteúdo da seção NOSSO SHOW (Show.tsx) — orçamento de shows. Para mudar um formato,
 * preço ou o repertório, altere só aqui. Telefones e Instagram: Contact/contactContent.ts.
 */

export type ShowPackage = {
  name: string;
  /** duração do show */
  duration: string;
  /** em reais */
  price: number;
};

export const SHOW_PACKAGES: ShowPackage[] = [
  { name: "Voz e violão", duration: "2h30 de show", price: 1500 },
  { name: "Voz, violão e bateria", duration: "2h30 de show", price: 1800 },
  { name: "Voz, violão, sanfona e bateria", duration: "2h30 de show", price: 2200 },
  { name: "Bruno e Benício e banda", duration: "2h30 de show", price: 3000 },
];

export const SHOW_REPERTOIRE = {
  styles: "Sertanejo, modão, MPB, pagode, pop rock e forró.",
  note: "Aberto a pedidos",
};

export const SHOW_INCLUDES = "Estrutura de som e iluminação";

/** 1500 → "R$ 1.500,00" */
export function formatPrice(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
