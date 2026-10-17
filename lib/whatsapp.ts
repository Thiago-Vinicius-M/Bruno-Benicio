/**
 * WhatsApp: validação/normalização de números e o link oficial de conversa (wa.me),
 * que abre o app no celular e o WhatsApp Web/Desktop no computador. Usado pela seção
 * CONTATO, pelo cadastro de vendedores e pelo botão "Voltar ao WhatsApp". Sem
 * dependências: entra no bundle do site público.
 */

/** E.164 sem o "+": DDI + número, 10 a 15 dígitos, sem zero à esquerda. */
const INTERNATIONAL = /^[1-9]\d{9,14}$/;
/** Brasil: 55 + DDD (sem zero) + fixo de 8 dígitos (2-5) ou celular de 9 dígitos (9). */
const BRAZIL = /^55[1-9][1-9]([2-5]\d{7}|9\d{8})$/;
/** Só o que aparece em números digitados: dígitos, espaços, parênteses, ponto, hífen e "+" no início. */
const TYPED_NUMBER = /^\+?[\d\s().-]+$/;

/** Número já normalizado (só dígitos) e aceito pelas mesmas regras do banco. */
export const isValidWhatsApp = (digits: unknown): digits is string =>
  typeof digits === "string" && INTERNATIONAL.test(digits) && (!digits.startsWith("55") || BRAZIL.test(digits));

export type WhatsAppNumber = { ok: true; digits: string } | { ok: false; message: string };

const invalid = (message: string): WhatsAppNumber => ({ ok: false, message });

/**
 * Texto digitado → só dígitos (DDI + DDD + número), pronto para o link. Aceita
 * "+55 (62) 99999-9999", "55 62 99999 9999", "0055...". Sem o código do país, só
 * números brasileiros (começando por 55) são aceitos; estrangeiros precisam do "+".
 */
export function normalizeWhatsApp(raw: string | null | undefined): WhatsAppNumber {
  const text = raw?.trim() ?? "";
  if (!text) return invalid("Informe o número de WhatsApp.");
  if (!TYPED_NUMBER.test(text)) return invalid("Use só números, espaços, parênteses, hífen e o + do código do país.");

  let digits = text.replace(/\D/g, "");
  const explicitCountry = text.startsWith("+") || digits.startsWith("00");
  digits = digits.replace(/^00/, "");

  if (!explicitCountry && !digits.startsWith("55")) {
    return invalid("Inclua o código do país e o DDD: +55 para o Brasil (ex.: +55 62 99999-9999).");
  }
  if (digits.startsWith("55") && !BRAZIL.test(digits)) {
    return invalid("Número brasileiro inválido: use +55, o DDD e o número (celular com 9 dígitos).");
  }
  if (!INTERNATIONAL.test(digits)) {
    return invalid("Número inválido: informe o código do país, o DDD e o número.");
  }
  return { ok: true, digits };
}

/** 5562999998888 → "+55 (62) 99999-8888". Estrangeiros: "+" e os dígitos. */
export function formatWhatsApp(digits: string): string {
  const brazil = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  if (brazil && BRAZIL.test(digits)) return `+55 (${brazil[1]}) ${brazil[2]}-${brazil[3]}`;
  return `+${digits}`;
}

/** Link que abre a conversa com a mensagem já escrita (o contratante revisa e envia). */
export function whatsappUrl(digits: string, message: string): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Abre o WhatsApp com a mensagem pronta para quem a pessoa escolher (sem número fixo). */
export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
