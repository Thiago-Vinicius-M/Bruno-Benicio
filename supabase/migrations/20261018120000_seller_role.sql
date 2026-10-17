-- =============================================================================
-- Papel SELLER (vendedor com conta no painel)
--
--   * Arquivo separado de propósito: um valor novo de enum só pode ser usado depois que
--     a transação que o criou termina. A migration seguinte (20261018120100) define as
--     permissões do papel.
--   * Sozinho, este arquivo não dá acesso a nada: private.is_staff() ainda aceitaria
--     qualquer papel, por isso a próxima migration precisa ser aplicada junto (antes de
--     criar qualquer perfil SELLER).
-- =============================================================================

alter type public.app_role add value if not exists 'SELLER';
