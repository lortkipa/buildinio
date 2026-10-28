import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The preview serves the built app from a sub-path, so asset links must stay relative.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
