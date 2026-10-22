<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/buildinio-logo-dark-bg.svg">
    <img src="assets/brand/buildinio-logo-light-bg.svg" alt="Buildinio" width="360">
  </picture>
</p>

<p align="center">An AI app builder for non-technical people. Describe what you want, get a working app with a live preview.</p>

## Status

Early development. Phase 1 generates frontend-only web apps (React, Vite, Tailwind CSS, shadcn/ui).

The platform is scaffolded: a Next.js web app, a Hono API and a PostgreSQL database. For now the web app shows a status page that checks the connection to the API and the database.

## Getting started

You need [Node.js](https://nodejs.org) 22 or newer, pnpm (run `corepack enable` once) and [Docker](https://docs.docker.com/get-docker/).

### Development

```sh
pnpm install
pnpm db:up     # start Postgres in Docker
pnpm dev       # web on http://localhost:3000, API on http://localhost:4000
```

Open http://localhost:3000. Web, API and Database should all show **Connected**. Stop the database with `pnpm db:down`.

The defaults need no configuration. To override them, copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`.

### Production

The whole stack (Postgres, API, web) runs with Docker Compose:

```sh
cp .env.example .env   # then set a strong POSTGRES_PASSWORD
pnpm prod:up           # build images and start; the web app is on http://localhost:3000
pnpm prod:logs         # follow logs
pnpm prod:down         # stop (data stays in the postgres-data volume)
```

Only the web app is published to the host. Set `WEB_PORT` in `.env` to use another port.

### Other commands

| Command | What it does |
|---|---|
| `pnpm build` | Build all apps |
| `pnpm typecheck` | Type-check all packages |
| `pnpm lint` / `pnpm format` | Check / fix lint and formatting (Biome) |
| `pnpm db:generate` / `pnpm db:migrate` | Create / apply database migrations (Drizzle) |
| `pnpm db:studio` | Browse the database in Drizzle Studio |

## License

See [LICENSE](LICENSE).
