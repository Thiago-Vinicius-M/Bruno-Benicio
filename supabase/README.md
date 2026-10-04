# Supabase: Agenda

Banco, autenticação e permissões da área **Agenda** e do painel. As migrations em `migrations/` são a fonte da verdade: nada deve ser alterado manualmente no dashboard.

## Configurar um projeto

1. Crie o projeto no Supabase e copie `.env.example` para `.env.local` (URL, publishable key e secret key).
2. Aplique as migrations, em ordem, escolhendo uma das opções:
   - **CLI:** `npx supabase init` (cria `config.toml` e mantém `migrations/`), `npx supabase link --project-ref <ref>` e `npx supabase db push`.
   - **Sem CLI:** cole cada arquivo de `migrations/` no SQL Editor, em ordem de nome, e execute cada um uma única vez (`20260929120000_agenda_infrastructure.sql`, depois `20260930120000_users_management.sql`).
3. Regenere os tipos: `npm run db:types`. Isso sobrescreve `lib/supabase/database.types.ts`.
4. **Auth** (Dashboard → Authentication):
   - **Desative "Allow new users to sign up".** Usuários entram só por convite. Mesmo que alguém se cadastre, fica sem perfil e o RLS nega todo acesso, mas não há motivo para deixar a porta aberta.
   - Em *URL Configuration*: **Site URL** = `https://<site>` e, em **Redirect URLs**, `https://<site>/auth/confirm**` (e `http://localhost:3000/auth/confirm**` para desenvolvimento). É o callback do painel (`app/auth/confirm/route.ts`) para recuperação de senha e convites.
   - **E-mail (SMTP) para convites.** O provedor de e-mail embutido do Supabase é só para testes: envia pouquíssimos e-mails por hora. Para convidar usuários de verdade, configure um SMTP próprio em *Authentication → Emails → SMTP Settings*. Sem isso, o convite falha com "Muitas tentativas" depois de poucos envios.
   - Recomendado: em *Email Templates → Invite user*, troque o link por `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`. Com o template padrão, o link também funciona: a sessão chega no fragmento da URL (`#access_token`, que o servidor não recebe) e `/painel/confirmar` a conclui no navegador. Nos dois casos, o convidado cai em `/painel/configuracoes/senha?convite=1` para definir a própria senha.
   - Recomendado: em *Email Templates → Reset Password*, troque o link por `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`. Assim o link funciona mesmo aberto em outro aparelho. O link padrão (`?code=`, PKCE) também é aceito, mas só funciona no mesmo navegador que pediu a recuperação.
5. **Primeiro ADMIN** (bootstrap, uma vez). Convide o usuário em *Authentication → Users → Invite* e rode no SQL Editor:

   ```sql
   insert into public.profiles (id, name, role)
   select id, 'Bruno', 'ADMIN' from auth.users where email = 'email@do-admin.com';
   ```

   Os demais usuários são convidados pelo próprio ADMIN pela aplicação (`inviteUser`). O papel padrão é `EDITOR`. `ADMIN` só é atribuído explicitamente, nunca a partir de dados enviados pelo usuário.

## Painel (`/painel`)

| Rota | Acesso |
| --- | --- |
| `/painel/login`, `/painel/recuperar-senha` | Visitantes. Com sessão, o proxy manda para `/painel`. |
| `/painel`, `/painel/configuracoes/senha` e o que vier em `/painel/*` | Sessão + perfil ativo. |
| `/painel/usuarios` | Somente ADMIN ativo. EDITOR vai para `/painel/acesso-negado?motivo=admin`. |
| `/painel/acesso-negado` | Sessão sem perfil ativo (desativado ou sem `profiles`), ou EDITOR numa área de ADMIN. |
| `/painel/confirmar` | Sempre aberta. Conclui links do Auth com a sessão no fragmento (convite no template padrão). |
| `/auth/confirm` | Callback dos e-mails do Auth. |

Duas camadas: `proxy.ts` renova a sessão e faz a checagem otimista (há sessão?), e cada página/Server Action protegida chama `requirePanelUser()` (`lib/painel/session.ts`), que valida a sessão no Auth e lê o perfil do banco. Quem tem sessão mas não tem perfil ativo vai para `/painel/acesso-negado`, nunca de volta ao login, o que evita loop. O papel exibido vem sempre de `profiles.role`.

**Áreas de ADMIN** (`/painel/usuarios` e as ações dela) têm quatro camadas. A página e cada Server Action chamam `requirePanelAdmin()`: sessão validada no Auth, perfil ativo e `role = ADMIN`, tudo lido no servidor. As funções de `lib/agenda/usersAdmin.ts` repetem a checagem com `requireAdmin`. Por fim, o RLS e o trigger de `profiles` barram o que sobrar. A secret key só é usada no servidor (`lib/supabase/admin.ts`, com `server-only`) e só depois dessas checagens.

## Testes do banco

`npm run test:db` executa a migration real num Postgres embutido (PGlite), com um shim do ambiente Supabase (`supabase/tests/support/testDb.ts`), e testa policies, triggers e funções diretamente em SQL, como cada papel. Não precisa de Docker.

**Contra o projeto real (opt-in).** `supabase/tests/real/` exercita a Agenda e os Usuários do painel no Supabase configurado em `.env.local` (Auth, RLS, triggers e persistência de verdade). Os testes criam um ADMIN e um EDITOR temporários (`@example.com`) e apagam tudo no final. Com `PANEL_BASE_URL` apontando para um `next start` local, também testam as rotas por HTTP com os cookies de sessão reais. Por criar dados, não rodam no `npm test`. O Auth limita logins e e-mails por hora, então evite rodar várias vezes seguidas:

```sh
SUPABASE_REAL_TESTS=1 PANEL_BASE_URL=http://localhost:3123 node --env-file=.env.local node_modules/vitest/vitest.mjs run --project db supabase/tests/real
```

## Decisões de modelagem

**Papéis.** `profiles.role` (`ADMIN` | `EDITOR`) é lido por `private.current_app_role()`, que é `SECURITY DEFINER`, fica num schema não exposto pela API e só responde sobre o próprio `auth.uid()`. As policies usam `private.is_staff()` e `private.is_admin()`, sem consultar `profiles` sob RLS, o que evita recursão. Usuário desativado ou sem perfil tem papel `NULL`, logo não tem acesso.

**Perfis.** O ADMIN lê e edita todos os perfis. Os demais só leem o próprio (necessário para a autenticação) e não editam nada. A Agenda mostra "criado/excluído por" via `get_team_names()`, que devolve só id e nome para staff ativo.

**Troca de papel.** Um trigger impede que alguém que não seja ADMIN altere `role` ou o status de desativação, inclusive do próprio perfil. Um ADMIN não rebaixa nem desativa a si mesmo (`AG004`), para evitar lockout acidental. O banco também não permite rebaixar ou desativar o último ADMIN ativo (`AG003`), nem pelo SQL Editor. Essa checagem é serializada com um advisory lock, então duas remoções simultâneas não zeram os ADMINs.

**Auditoria de usuários.** `profiles.created_by` (quem convidou) e `updated_by` (última alteração de nome, papel ou status) são definidos pelo trigger a partir da sessão, além de `deactivated_by`. Perfis anteriores à migration têm esses campos nulos.

**Auditoria.** `created_by`, `updated_by` e `deleted_by`, além dos timestamps, são sempre definidos por trigger a partir da sessão. Valores enviados pelo cliente são descartados, e `created_*` é imutável.

**Soft delete.** "Excluir" um show é `update shows set deleted_at = <qualquer valor>`. O trigger grava `now()` e o usuário da sessão. Não existe privilégio nem policy de `DELETE` em `shows`. Um show excluído não pode ser editado, só restaurado (`deleted_at = null`). As consultas normais filtram `deleted_at is null`, e a lixeira filtra `deleted_at is not null` (`listShows({ status: 'deleted' })`).

**Financeiro.** Fica em `show_financial_entries`, separado de `shows`, e é acessível somente a ADMIN em todas as operações. `amount` é `numeric(12,2)` e **sempre ≥ 0**. O sinal vem do tipo: `CACHE` e `OTHER_REVENUE` somam, `EXPENSE` subtrai. Assim uma "Comissão de 50" é `EXPENSE / 50` e não existem valores negativos ambíguos. Não é permitido lançar em show excluído, e os relatórios ignoram shows excluídos.

**Relatórios.** `get_financial_report(from, to, group_by)` agrega por `day`, `week` (ISO, segunda-feira), `month` ou `year` e devolve cachês, outras receitas, despesas e líquido. Um EDITOR recebe erro `42501`, e não totais zerados.

**Site público.** Visitantes (`anon`) não têm privilégio em nenhuma tabela. A única porta é `get_public_agenda(from, to)`, que devolve somente `id`, `show_date`, `show_time`, `venue_name` e `venue_instagram` de shows ativos, sem join com o financeiro. O "mês atual" é calculado na aplicação (`currentMonthRange`, fuso `America/Sao_Paulo`) e não é armazenado.

**Exclusão de usuários.** "Excluir" significa desativar: `deactivated_at` e `deactivated_by` no perfil (o RLS corta o acesso na hora) mais o bloqueio de login no Auth (`ban_duration`). Uma sessão que já estava aberta passa a receber `user_banned` do Auth, e o painel trata isso como acesso negado. Não há exclusão física pela interface. As FKs de auditoria apontam para `profiles` com `ON DELETE RESTRICT`. Por isso, apagar no Auth um usuário que já criou, editou ou excluiu algo **falha** e o histórico é preservado. Um usuário sem histórico pode ser apagado normalmente (o perfil sai em cascata).

**Índices.**

| Índice | Uso |
| --- | --- |
| `shows_active_date_idx (show_date, show_time) WHERE deleted_at IS NULL` | Agenda pública e listagem do painel por período, já ordenadas |
| `shows_deleted_at_idx (deleted_at DESC) WHERE deleted_at IS NOT NULL` | Lixeira do painel |
| `show_financial_entries_show_id_idx (show_id, created_at)` | Lançamentos de um show e join do relatório |

As FKs de auditoria não têm índice próprio. As tabelas são pequenas, e o único uso dessas colunas em filtro seria a exclusão de usuários, que é rara.

**Códigos de erro próprios.** `AG001`: editar show excluído. `AG002`: lançar valor em show excluído. `AG003`: remover o último ADMIN. `AG004`: ADMIN removendo o próprio acesso. Todos são mapeados para `CONFLICT` em `lib/agenda/errors.ts`.
