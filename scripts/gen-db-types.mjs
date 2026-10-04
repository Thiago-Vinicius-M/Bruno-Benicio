// Gera lib/supabase/database.types.ts a partir do projeto Supabase do .env.local/.env.
// Só sobrescreve o arquivo se a saída for válida (um erro nunca corrompe os tipos).
// Requer login na CLI uma vez: `npx supabase login` (ou SUPABASE_ACCESS_TOKEN).
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const projectRef = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ausente ou inválida (esperado https://<ref>.supabase.co).");
  process.exit(1);
}

console.log(`Gerando tipos do projeto ${projectRef}...`);
const result = spawnSync(
  "npx",
  ["--yes", "supabase@2", "gen", "types", "typescript", "--project-id", projectRef, "--schema", "public"],
  { encoding: "utf8", shell: true, timeout: 180_000, stdio: ["ignore", "pipe", "pipe"] },
);

const output = result.stdout ?? "";
if (result.status !== 0 || !output.includes("export type Database")) {
  console.error("Falha ao gerar os tipos; o arquivo atual foi mantido.\n");
  const details = `${result.stderr ?? ""}\n${output}`.trim() || String(result.error ?? "");
  console.error(details);
  if (/access token/i.test(details)) {
    console.error("\nRode `npx supabase login` uma vez e tente de novo.");
  }
  process.exit(1);
}

writeFileSync("lib/supabase/database.types.ts", output);
console.log("OK: lib/supabase/database.types.ts atualizado.");
