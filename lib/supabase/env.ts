/**
 * Configuração pública do Supabase (URL + publishable key), segura para o navegador.
 * A proteção dos dados é feita pelo RLS no banco, não pelo segredo desta chave.
 *
 * As variáveis precisam ser lidas de forma estática (`process.env.NEXT_PUBLIC_...`)
 * para o Next embuti-las no bundle do cliente.
 */
export type SupabasePublicEnv = { url: string; publishableKey: string };

export function getSupabasePublicEnv(): SupabasePublicEnv {
  return validatePublicEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function validatePublicEnv(url: string | undefined, publishableKey: string | undefined): SupabasePublicEnv {
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY em .env.local (veja .env.example).",
    );
  }
  if (isSecretKey(publishableKey)) {
    // Falha alta de propósito: uma chave secreta aqui iria parar no bundle público.
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contém uma chave SECRETA. Use a publishable key (sb_publishable_...) ou a anon key.",
    );
  }
  return { url, publishableKey };
}

/** Detecta secret keys novas (sb_secret_) e a service_role legada (JWT com role service_role). */
export function isSecretKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json?.role === "service_role";
  } catch {
    return false; // Não é um JWT: não é a service_role legada.
  }
}
