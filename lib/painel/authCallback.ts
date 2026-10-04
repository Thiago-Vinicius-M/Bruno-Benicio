import "server-only";
import { headers } from "next/headers";
import { getSiteUrl } from "@/lib/site";
import { PANEL_ROUTES } from "./routes";

/**
 * URL do callback `/auth/confirm` para links enviados por e-mail pelo Supabase Auth
 * (recuperação de senha e convite). Precisa estar na allow list do Supabase:
 * Authentication → URL Configuration → Redirect URLs (`https://<site>/auth/confirm**`).
 *
 * A origem vem da configuração (`SITE_URL` / domínio da Vercel) quando existe; os headers
 * da requisição ficam só como fallback (desenvolvimento local).
 */
export async function authCallbackUrl(next: string): Promise<string> {
  const url = new URL(PANEL_ROUTES.authConfirm, getSiteUrl() ?? (await requestOrigin()));
  url.searchParams.set("next", next);
  return url.toString();
}

async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return headerList.get("origin") ?? `${protocol}://${host}`;
}

/** Depois do link, o usuário cai direto na definição de senha. */
export const RECOVERY_NEXT = `${PANEL_ROUTES.changePassword}?recuperacao=1`;
export const INVITE_NEXT = `${PANEL_ROUTES.changePassword}?convite=1`;
