import { createSeller, setSellerActive, updateSeller } from "@/lib/sellers/sellersRepository";
import type { SellerInput } from "@/lib/sellers/types";
import type { AgendaClient } from "@/lib/supabase/client";
import { isUuid, runAction, type ActionResult } from "./actionResult";

/**
 * Vendedores do painel: regras das operações. O código do link é gerado pelo banco e
 * nunca vem do navegador. Somente ADMIN (requirePanelAdmin + RLS com private.is_admin()).
 * Cadastrar um vendedor não cria usuário do painel.
 */

export type SellerActionResult = ActionResult;

/** Entrada vinda do navegador: só nome e WhatsApp (code, active, auditoria são descartados). */
export function parseSellerInput(raw: unknown): SellerInput {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (key: string) => (typeof source[key] === "string" ? (source[key] as string) : "");
  return { name: text("name"), whatsapp: text("whatsapp") };
}

const invalidSeller: SellerActionResult = { status: "error", message: "Vendedor inválido." };
const FALLBACK = "Não foi possível salvar o vendedor. Tente novamente.";

export const createSellerFromInput = (client: AgendaClient, raw: unknown) =>
  runAction("vendedores", () => createSeller(client, parseSellerInput(raw)), {
    success: "Vendedor cadastrado. O link já pode ser compartilhado.",
    fallback: FALLBACK,
  });

export const updateSellerFromInput = async (client: AgendaClient, id: unknown, raw: unknown) =>
  isUuid(id)
    ? runAction("vendedores", () => updateSeller(client, id, parseSellerInput(raw)), {
        success: "Vendedor atualizado. O link continua o mesmo.",
        fallback: FALLBACK,
      })
    : invalidSeller;

export const setSellerActiveById = async (client: AgendaClient, id: unknown, active: unknown) =>
  isUuid(id) && typeof active === "boolean"
    ? runAction("vendedores", () => setSellerActive(client, id, active), {
        success: active ? "Vendedor ativado: o link voltou a funcionar." : "Vendedor desativado: o link deixou de funcionar.",
        fallback: FALLBACK,
      })
    : invalidSeller;
