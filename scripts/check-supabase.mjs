// Verifica o projeto Supabase real: migration, tabelas, isolamento do anônimo,
// Auth, primeiro ADMIN, tipos e conexão. Nada é gravado no banco.
//
//   npm run db:check              -> checagens automáticas
//   npm run db:check -- --login   -> também testa login real (pede e-mail/senha; senha oculta)
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";

const envFile = [".env.local", ".env"].find((file) => existsSync(file));
if (envFile) process.loadEnvFile(envFile);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

let failures = 0;
const report = (ok, label, detail = "") => {
  if (ok === false) failures++;
  const mark = ok === true ? "[✓]" : ok === false ? "[✗]" : "[ ]";
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ""}`);
};

const today = new Date();
const monthStart = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)).toISOString().slice(0, 10);
const monthEnd = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 0)).toISOString().slice(0, 10);

// 1. Ambiente
const envOk = Boolean(
  url && publishableKey?.startsWith("sb_publishable_") && secretKey?.startsWith("sb_secret_"),
);
report(envOk, "Variáveis de ambiente", envFile ? `lidas de ${envFile}` : "nenhum .env encontrado");
if (!envOk) process.exit(1);

const anon = createClient(url, publishableKey, noSession);
const admin = createClient(url, secretKey, noSession);

// 2. Migration + conexão (função pública da agenda)
const agenda = await anon.rpc("get_public_agenda", { p_from: monthStart, p_to: monthEnd });
report(!agenda.error, "Aplicação conecta e migration aplicada (get_public_agenda)",
  agenda.error ? `${agenda.error.code}: ${agenda.error.message}` : `${agenda.data.length} show(s) este mês`);

// 3. Tabelas existem
for (const table of ["profiles", "shows", "show_financial_entries"]) {
  const { error, count } = await admin.from(table).select("*", { count: "exact", head: true });
  report(!error, `Tabela ${table}`, error ? `${error.code}: ${error.message}` : `${count} linha(s)`);
}

// 4. Visitante anônimo isolado (grants revogados + RLS)
for (const table of ["profiles", "shows", "show_financial_entries"]) {
  const { error } = await anon.from(table).select("*").limit(1);
  report(error?.code === "42501", `Anônimo bloqueado em ${table}`, error ? error.code : "ACESSO PERMITIDO — verificar!");
}
const anonReport = await anon.rpc("get_financial_report", { p_from: monthStart, p_to: monthEnd });
report(Boolean(anonReport.error), "Anônimo bloqueado no relatório financeiro", anonReport.error?.code ?? "ACESSO PERMITIDO");

// 5. Auth
const settingsResponse = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: publishableKey } });
const settings = settingsResponse.ok ? await settingsResponse.json() : null;
report(Boolean(settings?.external?.email), "Auth configurado (login por e-mail)", settings ? "" : `HTTP ${settingsResponse.status}`);
report(settings?.disable_signup === true, "Cadastro público desativado",
  settings?.disable_signup ? "" : "ative em Authentication → Sign In / Providers → desmarcar 'Allow new users to sign up'");

// 6. Primeiro ADMIN
const admins = await admin.from("profiles").select("name, role").eq("role", "ADMIN").is("deactivated_at", null);
report(!admins.error && admins.data.length > 0, "ADMIN ativo criado",
  admins.error ? admins.error.message : admins.data.map((p) => p.name).join(", ") || "nenhum ADMIN em profiles");

// 7. Tipos regenerados
const types = readFileSync("lib/supabase/database.types.ts", "utf8");
const generated = types.includes("export type Database") && !types.includes("Escrito a partir de supabase/migrations");
report(generated ? true : null, "Tipos regenerados do projeto", generated ? "" : "ainda é a versão escrita à mão (rode npm run db:types)");

// 8. Login
const wrong = await anon.auth.signInWithPassword({ email: "nao-existe@example.com", password: "senha-errada-123" });
report(wrong.error?.code === "invalid_credentials", "Login inválido é recusado", wrong.error?.code ?? "aceitou?!");

if (process.argv.includes("--login")) {
  const email = await ask("E-mail: ");
  const password = await ask("Senha: ", true);
  const client = createClient(url, publishableKey, noSession);
  const login = await client.auth.signInWithPassword({ email, password });
  report(!login.error, "Login real", login.error ? `${login.error.code}: ${login.error.message}` : "");
  if (!login.error) {
    const profile = await client.from("profiles").select("name, role").eq("id", login.data.user.id).maybeSingle();
    report(Boolean(profile.data), "Sessão lê o próprio perfil (RLS)", profile.data ? `${profile.data.name} (${profile.data.role})` : profile.error?.message ?? "sem perfil");
    if (profile.data?.role === "ADMIN") {
      const finance = await client.rpc("get_financial_report", { p_from: monthStart, p_to: monthEnd });
      report(!finance.error, "ADMIN acessa relatório financeiro", finance.error?.message ?? "");
    }
    await client.auth.signOut();
    const after = await client.auth.getUser();
    report(!after.data.user, "Logout encerra a sessão");
  }
} else {
  report(null, "Login real", "rode `npm run db:check -- --login` no seu terminal");
}

console.log(failures ? `\n${failures} verificação(ões) falharam.` : "\nTudo certo.");
process.exit(failures ? 1 : 0);

function ask(question, hidden = false) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    rl._writeToOutput = (text) => {
      if (text.startsWith(question)) rl.output.write(question);
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    }),
  );
}
