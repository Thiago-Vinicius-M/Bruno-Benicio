/**
 * Rotas do painel administrativo. Fonte única para o proxy, as Server Actions,
 * o callback de autenticação e a navegação — nada de strings soltas espalhadas.
 */
export const PANEL_ROUTES = {
  home: "/painel",
  login: "/painel/login",
  recoverPassword: "/painel/recuperar-senha",
  accessDenied: "/painel/acesso-negado",
  /** Conclui links do Auth que trazem a sessão no fragmento (#access_token), invisível ao servidor. */
  confirmLink: "/painel/confirmar",
  changePassword: "/painel/configuracoes/senha",
  agenda: "/painel/agenda",
  /** Exclusiva de ADMIN. */
  users: "/painel/usuarios",
  /** Callback do Supabase Auth (recuperação de senha e convites). */
  authConfirm: "/auth/confirm",
} as const;

/** Páginas acessíveis sem sessão. Um usuário logado que abre uma delas vai para o painel. */
const GUEST_ONLY = new Set<string>([PANEL_ROUTES.login, PANEL_ROUTES.recoverPassword]);

/** Sempre acessíveis: quem chega por um link de convite pode ou não já ter sessão. */
const ALWAYS_PUBLIC = new Set<string>([PANEL_ROUTES.confirmLink]);

const normalize = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);

export const isPanelPath = (pathname: string) => {
  const path = normalize(pathname);
  return path === PANEL_ROUTES.home || path.startsWith(`${PANEL_ROUTES.home}/`);
};

/**
 * Decisão do proxy (checagem otimista, só pela sessão do Supabase). Devolve para onde
 * redirecionar, ou `null` para seguir. Perfil e status de desativação são checados no
 * servidor pelas páginas (lib/painel/session.ts), que nunca mandam de volta ao login
 * um usuário logado — por isso não há loop login ↔ painel.
 */
export function panelRedirect(pathname: string, isAuthenticated: boolean): string | null {
  const path = normalize(pathname);
  if (!isPanelPath(path) || ALWAYS_PUBLIC.has(path)) return null;
  if (GUEST_ONLY.has(path)) return isAuthenticated ? PANEL_ROUTES.home : null;
  return isAuthenticated ? null : PANEL_ROUTES.login;
}

/**
 * Destino pós-callback vindo da URL (`?next=`). Só aceita caminhos internos do painel,
 * para o link do e-mail não virar um open redirect.
 */
export function safePanelPath(next: string | null | undefined, fallback: string = PANEL_ROUTES.home): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  try {
    const url = new URL(next, "http://painel.local");
    if (url.origin !== "http://painel.local" || !isPanelPath(url.pathname)) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
