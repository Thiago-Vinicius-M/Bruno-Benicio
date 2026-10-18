import type { AgendaClient } from "@/lib/supabase/client";
import {
  createShowModel,
  moveShowModel,
  setShowModelActive,
  updateShowModel,
} from "@/lib/showModels/showModelsRepository";
import type { ShowModelInput } from "@/lib/showModels/types";
import { isUuid, runAction, type ActionResult } from "./actionResult";

/**
 * Modelos de show do painel: regras das operações. Tudo passa pelo repositório (nenhuma
 * chamada Supabase direta aqui); autoria e posição são definidas pelo banco. Somente
 * ADMIN (Server Actions com requirePanelAdmin + RLS com private.is_admin()).
 */

export type ShowModelActionResult = ActionResult;

/**
 * Entrada vinda do navegador: só os campos do formulário. Qualquer outra propriedade
 * (created_by, position...) é descartada.
 */
export function parseShowModelInput(raw: unknown): ShowModelInput {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (key: string) => (typeof source[key] === "string" ? (source[key] as string) : "");
  return {
    name: text("name"),
    duration: text("duration"),
    description: text("description"),
    price: typeof source.price === "number" ? source.price : text("price"),
    corporatePrice: typeof source.corporatePrice === "number" ? source.corporatePrice : text("corporatePrice"),
    active: source.active !== false,
  };
}

const invalidModel: ShowModelActionResult = { status: "error", message: "Modelo de show inválido." };
const SAVE = {
  fallback: "Não foi possível salvar o modelo. Tente novamente.",
  duplicate: "Já existe um modelo com este nome.",
};

export const createShowModelFromInput = (client: AgendaClient, raw: unknown) =>
  runAction("modelos", () => createShowModel(client, parseShowModelInput(raw)), {
    ...SAVE,
    success: "Modelo de show adicionado.",
  });

export const updateShowModelFromInput = async (client: AgendaClient, id: unknown, raw: unknown) =>
  isUuid(id)
    ? runAction("modelos", () => updateShowModel(client, id, parseShowModelInput(raw)), {
        ...SAVE,
        success: "Modelo de show atualizado. O site já mostra a alteração.",
      })
    : invalidModel;

export const setShowModelActiveById = async (client: AgendaClient, id: unknown, active: unknown) =>
  isUuid(id) && typeof active === "boolean"
    ? runAction("modelos", () => setShowModelActive(client, id, active), {
        ...SAVE,
        success: active ? "Modelo ativado: já aparece no site." : "Modelo desativado: não aparece mais no site.",
      })
    : invalidModel;

export const moveShowModelById = async (client: AgendaClient, id: unknown, direction: unknown) =>
  isUuid(id) && (direction === "up" || direction === "down")
    ? runAction("modelos", () => moveShowModel(client, id, direction), {
        success: "Ordem atualizada.",
        fallback: "Não foi possível mudar a ordem. Tente novamente.",
      })
    : invalidModel;
