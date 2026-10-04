"use server";

import { redirect } from "next/navigation";
import {
  changePassword,
  field,
  loginWithPassword,
  sendRecoveryEmail,
  signOutQuietly,
  type FormState,
} from "@/lib/painel/authForms";
import { authCallbackUrl, RECOVERY_NEXT } from "@/lib/painel/authCallback";
import { PANEL_ROUTES } from "@/lib/painel/routes";
import { requirePanelUser } from "@/lib/painel/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Server Actions do painel: cada uma é um endpoint público, então valida tudo no
 * servidor. As regras ficam em lib/painel/authForms.ts; aqui só entram cliente e
 * redirecionamento (sempre fora de try/catch, pois `redirect` lança).
 */

export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  const client = await createSupabaseServerClient();
  const result = await loginWithPassword(client, field(formData, "email"), field(formData, "password"));
  if (result.status !== "success") return result;
  redirect(PANEL_ROUTES.home);
}

export async function logoutAction(): Promise<void> {
  await signOutQuietly(await createSupabaseServerClient());
  redirect(PANEL_ROUTES.login);
}

export async function recoverPasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const client = await createSupabaseServerClient();
  return sendRecoveryEmail(client, field(formData, "email"), await authCallbackUrl(RECOVERY_NEXT));
}

export async function changePasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  await requirePanelUser();
  const client = await createSupabaseServerClient();
  return changePassword(client, field(formData, "password"), field(formData, "confirmation"));
}

