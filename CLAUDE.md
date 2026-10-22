# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Buildinio is an AI app builder for non-technical people, similar to Lovable or Replit. Users describe what they want, and Buildinio generates a working app with a live preview.

### Roadmap

- **Phase 1 (current):** a web platform that generates **frontend-only web apps**.
- **Later:** backends for generated apps (DB, auth, APIs), then generated desktop and mobile apps, then desktop and mobile clients for the Buildinio platform itself.

Build only what the current phase needs. For example, don't add backend, database or auth features to generated apps yet.

## Status

Scaffolded. The monorepo, web app, API and database are wired together. The only feature is a status page at `/` in the web app that shows whether the web app, the API and the database are reachable. There are no tables, migrations, auth or tests yet, and no generated-app template.

## Tech stack

### Platform (Buildinio itself)

| Area | Choice |
|---|---|
| Language | TypeScript |
| Monorepo | pnpm workspaces + Turborepo |
| Web app | Next.js (App Router) |
| API | Hono |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Better Auth (not set up yet) |
| DB driver | postgres (postgres.js) |
| Styling | Tailwind CSS |
| Lint / format | Biome |
| API build | tsup (bundles all dependencies into `dist/index.js`) |
| Production | Docker Compose (`compose.prod.yaml`) |

### Generated apps (what users get)

| Area | Choice |
|---|---|
| Framework | React + Vite + TypeScript |
| Styling / UI | Tailwind CSS + shadcn/ui |
| Backend | None in Phase 1 (frontend only) |

### Sandbox and live preview

Generated apps run in **self-hosted containers** (Docker). Still open: the production isolation layer (e.g. gVisor or Firecracker) and the hosting choice.

## Brand

The logo is a rounded triangle with a five-stop gradient (`#FFB21E` `#FF4F6D` `#E23FA8` `#7A5BFF` `#2E9BFF`). The wordmark is "Buildinio" in Gabarito Bold. The files are in `assets/brand/`: the logo with the name for light and dark backgrounds, the triangle mark on its own, and 512×512 GitHub avatars. Use these files as they are. Don't redraw or recolor the logo.

`assets/brand/` is the source of truth. The web app serves unchanged copies: the two logo SVGs in `apps/web/public/brand/` and the mark as the favicon in `apps/web/app/icon.svg`. If a brand file changes, copy it again.

## Repository layout

```
assets/brand        Logo files (SVG and PNG), source of truth
apps/web            Next.js platform frontend (status page at /)
apps/api            Hono API server (GET /health, GET /status)
packages/db         Drizzle client, schema, health check, drizzle.config.ts
packages/shared     Types shared by web and API (e.g. StatusResponse)
packages/tsconfig   Shared TypeScript config (@buildinio/tsconfig/base.json)
compose.yaml        Dev database (Postgres)
compose.prod.yaml   Production stack (Postgres + API + web)
```

Planned, not created yet: `templates/` for the generated-app base template(s), and more `packages/*` (UI, config) as they are needed.

Notes:

- Workspace packages export TypeScript source (no build step). The API bundles them with tsup; Next.js compiles them via `transpilePackages`.
- The web app calls the API from the server (`API_URL`, default `http://localhost:4000`), so there is no CORS setup.
- `apps/web/AGENTS.md` is written and kept up to date by `next dev`. Keep it committed and don't edit its managed block.
- Each app's Dockerfile uses `turbo prune`, so anything an app needs at build time must live in a workspace package, not at the repo root.

## Commands

Run from the repo root. Requires Node 22+, pnpm (via `corepack enable`) and Docker.

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm db:up` / `pnpm db:down` | Start / stop the dev Postgres (`compose.yaml`, host port `DB_PORT`, default 5432) |
| `pnpm dev` | Run web (http://localhost:3000) and API (http://localhost:4000) with reload, and open the web app in the browser once it responds (`BROWSER=none` skips that; see `apps/web/scripts/open-browser.mjs`) |
| `pnpm build` | Build all apps |
| `pnpm typecheck` | Type-check all packages |
| `pnpm lint` | Lint and check formatting (Biome) |
| `pnpm format` | Apply Biome formatting and safe fixes |
| `pnpm db:generate` | Generate a migration from `packages/db/src/schema.ts` |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL` (default: dev database) |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm prod:up` | Build and start the production stack (needs `.env` with `POSTGRES_PASSWORD`) |
| `pnpm prod:down` / `pnpm prod:logs` | Stop the production stack / follow its logs |

There are no tests yet. Add a `test` command here when the first tests land. Migrations are not run automatically in production yet; add that step when the first migration exists.

Environment variables: the root `.env` holds `DB_PORT` (dev database host port, read by `compose.yaml`, the API dev server and Drizzle Kit) and `POSTGRES_PASSWORD` / `WEB_PORT` (production). The API reads `DATABASE_URL` (overrides the URL built from `DB_PORT`) and `PORT` (optional `apps/api/.env`); the web app reads `API_URL` (optional `apps/web/.env.local`). Dev defaults work without any env files. See the `.env.example` files.

## Working rules

- **Docs stay current.** Keep `CLAUDE.md` and all other documentation clean and up to date. Update them in the same change that alters structure, commands, stack or behavior. Remove anything stale.
- **Branch names** follow `<type>/<short-kebab-description>`, e.g. `feat/sandbox-preview` or `fix/preview-reload`. Allowed types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`. Never use random or auto-generated names.
- **Presenting options:** when offering choices, state a recommendation and give pros and cons for every option.
