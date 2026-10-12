import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { RECOVERY_NEXT } from "@/lib/painel/authCallback";
import { PANEL_ROUTES, safePanelPath } from "@/lib/painel/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Volta dos links de recuperação de senha enviados por e-mail pelo Supabase Auth.
 * Troca o token do link por uma sessão (cookies gravados pelo @supabase/ssr) e segue
 * para `next`, que só pode ser um caminho do painel.
 *
 * Aceita os dois formatos de link:
 * - `?token_hash=...&type=recovery` (template de e-mail recomendado; funciona mesmo
 *   abrindo o link em outro aparelho);
 * - `?code=...` (padrão PKCE do Supabase; exige o mesmo navegador que pediu o link).
 */
const ACCEPTED_TYPES = new Set<EmailOtpType>(["recovery"]);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  // A recuperação sempre termina na definição de senha, mesmo sem `next` no template.
  const fallback = type === "recovery" ? RECOVERY_NEXT : PANEL_ROUTES.home;
  const next = safePanelPath(params.get("next"), fallback);

  const supabase = await createSupabaseServerClient();
  let error: unknown = new Error("Tipo de link não aceito.");

  if (tokenHash && type && ACCEPTED_TYPES.has(type)) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  }

  // `redirect` fora de try/catch (ele lança para interromper a execução).
  redirect(error ? `${PANEL_ROUTES.login}?erro=link` : next);
}
