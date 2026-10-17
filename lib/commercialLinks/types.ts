import type { Role } from "@/lib/agenda/types";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * Links comerciais: propostas temporárias (/p/<código>) criadas por um usuário (ADMIN ou
 * SELLER) com um dos seus canais de WhatsApp e os modelos de show escolhidos. Tudo o que o
 * cliente vê e o destino do contato ficam gravados no link (imutável).
 */

/** Canal de WhatsApp autorizado de um usuário. Cadastrado só por ADMIN. */
export type WhatsAppChannel = Tables<"whatsapp_channels">;

/** Usuário que pode receber canais (get_whatsapp_channel_owners): ativo, ADMIN ou SELLER. */
export type ChannelOwner = { id: string; name: string; role: Role };

/** O que o usuário logado pode fazer no módulo (get_commercial_link_permissions). */
export type LinkPermissions = { canCreate: boolean; canCustomizePrices: boolean };

/** Modelo ativo com o preço padrão atual: ponto de partida de um link novo. */
export type LinkModel = { id: string; name: string; price: number };

/** Status no histórico, pelo relógio do banco. `inactive`: sem WhatsApp disponível (canal ou dono do canal desativado). */
export type CommercialLinkStatus = "active" | "expired" | "revoked" | "inactive";

/** Preço gravado no link (nome atual do modelo). `default_price` nulo nos links antigos. */
export type CommercialLinkPrice = { model_id: string; name: string; price: number; default_price: number | null };

/** Link no histórico (get_seller_links). ADMIN vê todos; SELLER, os que criou. */
export type CommercialLink = {
  id: string;
  code: string;
  label: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  expires_at: string;
  deactivated_at: string | null;
  status: CommercialLinkStatus;
  /** Canal usado e a identificação e o número dele na época (imutáveis no link). */
  channel_id: string;
  channel_label: string;
  whatsapp: string;
  /** Número que recebe os contatos hoje (redirecionamento) ou null se nenhum. */
  destination: string | null;
  prices: CommercialLinkPrice[];
};

/** Prazos predefinidos (o banco calcula a expiração) ou data/horário escolhidos. */
export type LinkValidity = "24h" | "3d" | "7d" | "custom";

/** Criação validada, pronta para create_commercial_link. Preço `null` = preço padrão. */
export type CommercialLinkInput = {
  channelId: string;
  label: string | null;
  validity: LinkValidity;
  /** ISO, só em "custom" (já convertido do horário de Brasília). */
  expiresAt: string | null;
  items: { modelId: string; price: number | null }[];
};

/** Cadastro de canal (ADMIN). O número chega como digitado e é normalizado. */
export type ChannelInput = { ownerId: string; whatsapp: string; label: string; isPrimary: boolean };

/** Alteração de canal (ADMIN): só identificação e principal. Número e dono não mudam. */
export type ChannelUpdate = { label: string; isPrimary: boolean };
