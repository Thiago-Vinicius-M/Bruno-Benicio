/**
 * Situação de um código de link (get_seller_link):
 *   active   → libera a versão comercial
 *   inactive → canal de WhatsApp (ou o dono dele) desativado, sem redirecionamento
 *   expired  → prazo encerrado
 *   revoked  → desativado no painel antes de expirar
 *   invalid  → link sem preços (dado inconsistente)
 */
export type SellerLinkStatus = "active" | "inactive" | "expired" | "revoked" | "invalid";

/** O que o site público sabe de um código de link (get_seller_link). */
export type SellerLink = {
  status: SellerLinkStatus;
  active: boolean;
  /** Só quando ativo. */
  whatsapp: string | null;
  /** Instante de expiração (ISO), só de link ativo. */
  expiresAt: string | null;
};
