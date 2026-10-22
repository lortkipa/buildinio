import { createDb } from "@buildinio/db";
import { serve } from "@hono/node-server";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 4000);
const app = createApp(createDb(process.env.DATABASE_URL));

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
