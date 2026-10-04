import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // O pacote real lança erro fora do bundler do Next; nos testes basta um módulo vazio.
      "server-only": fileURLToPath(new URL("./test/serverOnlyStub.ts", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "app",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: [
            "app/**/*.test.{ts,tsx}",
            "components/**/*.test.{ts,tsx}",
            "animations/**/*.test.{ts,tsx}",
            "lib/**/*.test.{ts,tsx}",
          ],
        },
      },
      {
        // Migrations + RLS num Postgres embutido (PGlite); ver supabase/tests/support/testDb.ts.
        extends: true,
        test: {
          name: "db",
          environment: "node",
          include: ["supabase/tests/**/*.test.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
