import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  target: "node22",
  clean: true,
  // Bundle everything, including the TypeScript-source workspace packages,
  // so the production image needs no node_modules.
  noExternal: [/.*/],
});
