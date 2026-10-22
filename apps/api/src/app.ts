import type { Database } from "@buildinio/db";
import { checkDatabase } from "@buildinio/db";
import type { StatusResponse } from "@buildinio/shared";
import { Hono } from "hono";
import packageJson from "../package.json" with { type: "json" };

export function createApp(db: Database) {
  const app = new Hono();

  // Liveness: the process is up. Does not touch the database.
  app.get("/health", (c) => c.json({ status: "ok" }));

  // Status of the API and its database, shown on the web app's home page.
  app.get("/status", async (c) => {
    const body: StatusResponse = {
      api: {
        status: "ok",
        version: packageJson.version,
        uptimeSeconds: Math.round(process.uptime()),
      },
      database: await checkDatabase(db),
    };
    return c.json(body);
  });

  return app;
}
