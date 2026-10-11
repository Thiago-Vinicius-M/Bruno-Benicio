import type { Tables } from "@/lib/supabase/database.types";

/** Vendedor: contato comercial (não é usuário do painel). */
export type Seller = Tables<"sellers">;

/** Campos do formulário do painel. O código do link é sempre gerado pelo banco. */
export type SellerInput = {
  name: string;
  /** Como digitado ("+55 (62) 99999-9999"). */
  whatsapp: string;
};

/** O que o site público sabe de um código de link (get_seller_link). */
export type SellerLink = { active: boolean; whatsapp: string | null };
