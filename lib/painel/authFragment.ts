/**
 * Links do Supabase Auth no formato "implicit" (o padrão do e-mail de convite enviado
 * pela API admin) entregam a sessão no fragmento da URL, que nunca chega ao servidor:
 * `#access_token=...&refresh_token=...&type=invite`. Em caso de falha:
 * `#error=access_denied&error_code=otp_expired&error_description=...`.
 */
export type AuthFragment =
  | { kind: "session"; accessToken: string; refreshToken: string; type: string | null }
  | { kind: "error"; code: string | null }
  | { kind: "empty" };

export function parseAuthFragment(hash: string): AuthFragment {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    return { kind: "session", accessToken, refreshToken, type: params.get("type") };
  }
  if (params.has("error") || params.has("error_code")) return { kind: "error", code: params.get("error_code") };
  return { kind: "empty" };
}
