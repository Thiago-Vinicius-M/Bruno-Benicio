import { vi } from "vitest";
import type { AgendaClient } from "@/lib/supabase/client";

/**
 * Cliente Supabase falso para testes unitários da camada de dados: registra cada
 * chamada do query builder (from/select/eq/...) e devolve respostas programadas.
 * A segurança real (RLS) é testada em supabase/tests contra o Postgres.
 */
export type Call = [method: string, ...args: unknown[]];
type Response = { data: unknown; error: unknown };

export function createFakeSupabase(responses: Response[] = []) {
  const calls: Call[] = [];
  const queue = [...responses];
  const next = () => queue.shift() ?? { data: null, error: null };

  const builder = (): unknown =>
    new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then") {
            const response = next();
            return (resolve: (v: Response) => unknown, reject: (e: unknown) => unknown) =>
              Promise.resolve(response).then(resolve, reject);
          }
          return (...args: unknown[]) => {
            calls.push([String(prop), ...args]);
            return builder();
          };
        },
      },
    );

  const auth = {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    admin: {
      inviteUserByEmail: vi.fn(),
      updateUserById: vi.fn(),
      deleteUser: vi.fn(),
      listUsers: vi.fn(),
    },
  };

  const client = {
    from: (table: string) => {
      calls.push(["from", table]);
      return builder();
    },
    rpc: (fn: string, args: unknown) => {
      calls.push(["rpc", fn, args]);
      return builder();
    },
    auth,
  };

  return { client: client as unknown as AgendaClient, auth, calls };
}
