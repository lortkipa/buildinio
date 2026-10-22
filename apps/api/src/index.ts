import { createDb } from "@buildinio/db";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createAuth } from "./auth";

const port = Number(process.env.PORT ?? 4000);
const db = createDb(process.env.DATABASE_URL);
const app = createApp(db, createAuth(db));

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
