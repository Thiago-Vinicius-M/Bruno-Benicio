import { toAgendaError } from "@/lib/agenda/errors";

/** Resultado das Server Actions do painel (Modelos de Show e Vendedores), exibido no toast. */
export type ActionResult = { status: "success"; message: string } | { status: "error"; message: string };

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

type Messages = {
  success: string;
  /** Falha inesperada (detalhe técnico só no log do servidor). */
  fallback: string;
  /** Mensagem para violação de unicidade (23505), quando houver uma regra de nome único. */
  duplicate?: string;
};

/** Executa a operação e converte qualquer erro do Supabase numa mensagem segura para a tela. */
export async function runAction(tag: string, operation: () => Promise<unknown>, messages: Messages): Promise<ActionResult> {
  try {
    await operation();
    return { status: "success", message: messages.success };
  } catch (error) {
    const failure = toAgendaError(error);
    const sqlstate = (failure.cause as { code?: string } | undefined)?.code;
    if (messages.duplicate && sqlstate === "23505") return { status: "error", message: messages.duplicate };
    if (failure.code === "UNKNOWN") {
      console.error(`[${tag}]`, failure.cause ?? failure);
      return { status: "error", message: messages.fallback };
    }
    return { status: "error", message: failure.message };
  }
}
