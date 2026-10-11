import type { Database, Tables } from "@/lib/supabase/database.types";

/** Tipos de domínio derivados dos tipos gerados do banco (não duplicar colunas aqui). */

export type ShowModel = Tables<"show_models">;

/**
 * Modelo como o site público o enxerga (get_public_show_models): só ativos, sem auditoria
 * e SEM preço — o valor não sai do servidor para quem não chegou por um link comercial.
 */
export type PublicShowModel = Omit<
  Database["public"]["Functions"]["get_public_show_models"]["Returns"][number],
  "description"
> & {
  // O gerador de tipos não conhece a nulidade de colunas de RETURNS TABLE.
  description: string | null;
};

/** Versão comercial (get_commercial_show_models): o mesmo modelo com o valor. */
export type CommercialShowModel = PublicShowModel & { price: number };

/** Seção NOSSO SHOW: modelos carregados ou falha ao carregar (o site continua no ar). */
export type ShowModelsState = { status: "ready"; models: PublicShowModel[] } | { status: "error" };

/** Campos do formulário do painel. */
export type ShowModelInput = {
  name: string;
  /** Linha abaixo do nome (ex.: "2h30 de show"). */
  duration: string;
  description?: string | null;
  /** Como digitado ("1.500,00") ou já numérico. */
  price: string | number;
  /** Só no cadastro: ativar e desativar têm uma operação própria. */
  active?: boolean;
};

export type ShowModelMoveDirection = "up" | "down";
