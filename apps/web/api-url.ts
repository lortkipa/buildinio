// Where the API (apps/api) listens, for the server side of the web app: the /api/* rewrite in
// next.config.ts and session reads in app/session.ts. Browsers only ever call this app's /api/*.
// The rewrite is fixed at build time, so the production Dockerfile sets API_URL for the build too.
export const API_URL = process.env.API_URL ?? "http://localhost:4000";
