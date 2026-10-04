import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Postgres real (PGlite/WASM) com o mínimo do ambiente Supabase para rodar as
 * migrations de supabase/migrations e testar RLS/policies diretamente no banco.
 *
 * Os grants reproduzem o padrão do Supabase (ALL em public.* para anon e
 * authenticated), de propósito: quem precisa barrar o acesso é o RLS da migration.
 */
const SUPABASE_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations", import.meta.url));

export async function createTestDb(): Promise<PGlite> {
  const db = await PGlite.create();
  await db.exec(SUPABASE_SHIM);
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return db;
}

/** Cria usuário no Auth (e perfil, se `role` for informado) como superusuário. */
export async function createUser(
  db: PGlite,
  email: string,
  role?: "ADMIN" | "EDITOR",
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email) values ($1) returning id",
    [email],
  );
  const id = rows[0].id;
  if (role) {
    await db.query("insert into public.profiles (id, name, role) values ($1, $2, $3)", [
      id,
      email.split("@")[0],
      role,
    ]);
  }
  return id;
}

export type Caller = { role: "anon" } | { role: "authenticated"; userId: string } | { role: "postgres" };

export const anon: Caller = { role: "anon" };
export const superuser: Caller = { role: "postgres" };
export const asUser = (userId: string): Caller => ({ role: "authenticated", userId });

/** Troca o papel da transação atual, igual ao PostgREST (SET ROLE + claim `sub`). */
export async function actAs(db: PGlite, caller: Caller): Promise<void> {
  await db.exec("reset role");
  const sub = caller.role === "authenticated" ? caller.userId : "";
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [sub]);
  if (caller.role !== "postgres") await db.exec(`set local role ${caller.role}`);
}

/**
 * Executa `fn` como o papel informado dentro de uma transação que é sempre
 * desfeita — cada teste começa do mesmo estado.
 */
export async function runAs<T>(db: PGlite, caller: Caller, fn: (db: PGlite) => Promise<T>): Promise<T> {
  await db.exec("begin");
  try {
    await actAs(db, caller);
    return await fn(db);
  } finally {
    await db.exec("rollback");
  }
}

/**
 * Executa uma consulta que DEVE falhar e devolve o erro do Postgres. Usa savepoint
 * para que a transação de `runAs` continue utilizável depois do erro.
 */
export async function pgError(
  db: PGlite,
  sql: string,
  params: unknown[] = [],
): Promise<{ code?: string; message: string }> {
  await db.exec("savepoint expect_error");
  try {
    await db.query(sql, params);
  } catch (error) {
    await db.exec("rollback to savepoint expect_error");
    return error as { code?: string; message: string };
  }
  await db.exec("release savepoint expect_error");
  throw new Error(`Era esperado um erro do banco, mas a operação foi aceita: ${sql}`);
}
