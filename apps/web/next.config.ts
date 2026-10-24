import path from "node:path";
import type { NextConfig } from "next";
import { API_URL } from "./api-url";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the production Docker image.
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  // Let `next dev` serve its scripts to other devices on the local network (e.g. a phone
  // opening http://192.168.x.x:3000). By default it only serves localhost, so pages don't hydrate.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // `next dev`'s badge, by default bottom left, where it would cover the sidebar's user card.
  devIndicators: { position: "bottom-right" },
  // The API answers on this origin, so its sign-in cookies are first-party and there is no CORS.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
