import { formatEventDate } from "./eventSchedule";
import { formatPrice } from "./price";

/**
 * Mensagem que abre no WhatsApp do vendedor quando o contratante escolhe um modelo em
 * NOSSO SHOW. Nome e valor vêm do modelo exibido (validado no servidor). Data e horário
 * só entram quando informados — sem linhas vazias no lugar deles.
 */
export function buildContractMessage(
  model: { name: string; price: number },
  schedule: { date?: string | null; time?: string | null } = {},
): string {
  // formatPrice usa espaço não separável depois do "R$" (casado por \s); na mensagem, espaço comum.
  const price = formatPrice(model.price).replace(/\s/g, " ");
  return [
    "Olá! Acessei o portfólio do Bruno e Benício e tenho interesse em contratar a dupla.",
    "",
    `Modelo de show escolhido: ${model.name}`,
    `Valor apresentado: ${price}`,
    ...(schedule.date ? [`Data do evento: ${formatEventDate(schedule.date)}`] : []),
    ...(schedule.time ? [`Horário do evento: ${schedule.time}`] : []),
    "",
    "Gostaria de dar continuidade à negociação.",
  ].join("\n");
}
