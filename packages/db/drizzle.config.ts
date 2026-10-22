import { defineConfig } from "drizzle-kit";
import { defaultDatabaseUrl } from "./src/client";

// Pick up DB_PORT / DATABASE_URL from the root .env. Doesn't override variables already set.
try {
  process.loadEnvFile("../../.env");
} catch {
  // No root .env: use the defaults.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? defaultDatabaseUrl(),
  },
});
