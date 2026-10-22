import { defineConfig } from "tsup";

export default defineConfig({
  // The server, and the migration step the production image runs before it.
  entry: ["src/index.ts", "src/migrate.ts"],
  format: "esm",
  platform: "node",
  target: "node22",
  clean: true,
  // Bundle everything, including the TypeScript-source workspace packages,
  // so the production image needs no node_modules.
  noExternal: [/.*/],
});
