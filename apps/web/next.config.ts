import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the production Docker image.
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  // Let `next dev` serve its scripts to other devices on the local network (e.g. a phone
  // opening http://192.168.x.x:3000). By default it only serves localhost, so pages don't hydrate.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
