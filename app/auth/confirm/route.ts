import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { INVITE_NEXT, RECOVERY_NEXT } from "@/lib/painel/authCallback";
import { PANEL_ROUTES, safePanelPath } from "@/lib/painel/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Volta dos links enviados por e-mail pelo Supabase Auth (recuperação de senha e
 * convites). Troca o token do link por uma sessão (cookies gravados pelo
 * @supabase/ssr) e segue para `next`, que só pode ser um caminho do painel.
 *
 * Aceita os dois formatos de link:
 * - `?token_hash=...&type=recovery` (template de e-mail recomendado; funciona mesmo
 *   abrindo o link em outro aparelho);
 * - `?code=...` (padrão PKCE do Supabase; exige o mesmo navegador que pediu o link).
 */
const ACCEPTED_TYPES = new Set<EmailOtpType>(["recovery", "invite"]);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  // Recuperação e convite sempre terminam na definição de senha, mesmo sem `next` no template.
  const fallback = type === "recovery" ? RECOVERY_NEXT : type === "invite" ? INVITE_NEXT : PANEL_ROUTES.home;
  const next = safePanelPath(params.get("next"), fallback);

  // Sem token na query: o link pode trazer a sessão no fragmento (#access_token), como
  // no template padrão do convite. O navegador preserva o fragmento neste redirect.
  if (!code && !(tokenHash && type)) {
    redirect(`${PANEL_ROUTES.confirmLink}?next=${encodeURIComponent(next)}`);
  }

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
