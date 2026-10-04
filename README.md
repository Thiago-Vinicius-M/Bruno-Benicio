# Bruno & Benício

Site da dupla Bruno & Benício, com um painel administrativo privado em `/painel` (agenda de shows e usuários).

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack), React 19 e TypeScript
- GSAP + `@gsap/react` para as animações
- [Supabase](https://supabase.com): Auth, Postgres e RLS, usados pelo painel
- Vitest + Testing Library, além de PGlite para testar migrations e RLS sem Docker
- Gerenciador de pacotes: **npm**

## Rodar localmente

Requer Node.js 20.9 ou superior.

```sh
npm install
cp .env.example .env.local   # preencha os valores (veja abaixo)
npm run dev                  # http://localhost:3000
```

Banco, migrations, Auth e o primeiro ADMIN estão documentados em [supabase/README.md](supabase/README.md).

## Variáveis de ambiente

Os nomes e a função de cada uma estão em [.env.example](.env.example). Valores reais ficam só em `.env.local`, que não é commitado, e no painel da Vercel.

| Variável | Visibilidade | Obrigatória |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Pública (navegador) | Sim |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Pública (navegador) | Sim |
| `SUPABASE_SECRET_KEY` | **Somente servidor** | Sim (gestão de usuários) |
| `SITE_URL` | Somente servidor | Não (recomendada com domínio próprio) |

Nunca coloque a secret key numa variável `NEXT_PUBLIC_`. A aplicação se recusa a iniciar se detectar uma chave secreta ali.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run lint` | ESLint |
| `npm test` | Testes (app + banco em PGlite) |
| `npm run build` | Build de produção (inclui a checagem do TypeScript) |
| `npm start` | Serve o build de produção |
| `npm run db:types` | Regenera `lib/supabase/database.types.ts` |
| `npm run db:check` | Confere a conexão com o Supabase configurado |

## Deploy na Vercel

1. Importe o repositório na Vercel. O framework (Next.js), o comando de build e a pasta de saída são detectados automaticamente, sem precisar de `vercel.json`.
2. Em **Settings → Environment Variables**, cadastre as variáveis da tabela acima para *Production* e, se for usar previews, para *Preview*. `SUPABASE_SECRET_KEY` deve ser marcada como **Sensitive**.
3. Faça o deploy. As variáveis `NEXT_PUBLIC_` são embutidas no build, então depois de alterá-las é preciso fazer **Redeploy**.
4. No Supabase (*Authentication → URL Configuration*), defina **Site URL** com o domínio de produção e adicione `https://<domínio>/auth/confirm**` em **Redirect URLs**. Sem isso, os links de convite e de recuperação de senha não voltam para o site.
