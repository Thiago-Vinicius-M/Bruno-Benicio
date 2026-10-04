/**
 * Contato para contratar (seção CONTATO, Contact.tsx). Para mudar um número, a mensagem
 * do WhatsApp ou o Instagram, altere só aqui.
 */

/** Mensagem que já vem escrita na conversa do WhatsApp. */
export const WHATSAPP_MESSAGE = "Olá! Gostaria de mais informações sobre o show";

/** `display` como aparece na tela · `number` com país + DDD, só dígitos (formato do WhatsApp). */
export const CONTACT_PHONES = [
  { display: "(62) 99224-6887", number: "5562992246887" },
  { display: "(62) 99100-3836", number: "5562991003836" },
];

export const CONTACT_INSTAGRAM = {
  handle: "@brunoebeniciobb",
  url: "https://www.instagram.com/brunoebeniciobb/",
};

/** Link que abre a conversa no WhatsApp (app no celular, WhatsApp Web no computador). */
export function whatsappUrl(number: string, message = WHATSAPP_MESSAGE) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
