-- =============================================================================
-- Remoção da gestão de usuários pelo painel
--
--   * A tela de Usuários (convite, papel, desativação) saiu da aplicação. Perfis
--     passam a ser criados e alterados só pelo SQL Editor (postgres/service_role),
--     como no bootstrap do primeiro ADMIN.
--   * Pela API ninguém cria nem edita perfis, nem um ADMIN: as policies de INSERT e
--     UPDATE saem e os privilégios correspondentes são revogados de authenticated.
--   * Leitura: cada usuário lê só o próprio perfil (necessário para a autenticação).
--     Nomes para "criado/excluído por" continuam vindo de public.get_team_names().
--   * O trigger de profiles continua: auditoria e a proteção do último ADMIN ativo
--     (AG003) valem também no SQL Editor.
-- =============================================================================

drop policy "profiles: somente ADMIN cria" on public.profiles;
drop policy "profiles: somente ADMIN edita" on public.profiles;
drop policy "profiles: ADMIN lê todos; usuário lê o próprio" on public.profiles;

create policy "profiles: usuário lê o próprio"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

revoke insert, update on public.profiles from authenticated;

comment on column public.profiles.created_by is 'Quem criou o perfil (NULL quando criado pelo SQL Editor).';
