import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// This computer's own LAN addresses (e.g. 192.168.1.20). The dev server blocks
// other origins by default, so without this a phone on the same Wi-Fi gets the
// HTML but none of the JavaScript.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((net) => net?.family === "IPv4" && !net.internal)
  .map((net) => net!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanAddresses,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
