<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/buildinio-logo-dark-bg.svg">
    <img src="assets/brand/buildinio-logo-light-bg.svg" alt="Buildinio" width="360">
  </picture>
</p>

<p align="center">An AI app builder for non-technical people. Describe what you want, get a working app with a live preview.</p>

## Status

Early development. Phase 1 generates frontend-only web apps (React, Vite, Tailwind CSS, shadcn/ui).

The platform is scaffolded: a Next.js web app, a Hono API and a PostgreSQL database. For now the web app has a landing page with the prompt input, and accounts: sign-in with Google, a name step for new accounts, and Log out and Delete account on the home page. Sign-in with GitHub and email, and generating apps, are not built yet.

## Getting started

You need [Node.js](https://nodejs.org) 22 or newer, pnpm (run `corepack enable` once) and [Docker](https://docs.docker.com/get-docker/).

### Development

```sh
pnpm install
pnpm db:up       # start Postgres in Docker
pnpm db:migrate  # create or update the tables (again after pulling new migrations)
pnpm dev         # web on http://localhost:3000, API on http://localhost:4000
```

`pnpm dev` opens http://localhost:3000 in your browser once the app is ready (run `BROWSER=none pnpm dev` to skip that). To check that the API and the database are connected, run `curl http://localhost:4000/status`. Stop the database with `pnpm db:down`.

Port 5432 already in use? Put another port in a root `.env` file. Compose, the API and Drizzle Kit all follow it:

```sh
echo "DB_PORT=5433" >> .env
pnpm db:down && pnpm db:up
```

The defaults need no configuration. For other overrides, see `.env.example`, `apps/api/.env.example` (copy to `apps/api/.env`) and `apps/web/.env.example` (copy to `apps/web/.env.local`).

#### Google sign-in

Without keys, "Continue with Google" says that it isn't set up. To turn it on:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth client ID of type "Web application".
2. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
3. Put the client's keys in the root `.env`, then restart `pnpm dev`:

   ```sh
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

Google accepts `localhost` but not LAN addresses as redirect URIs, so in development Google sign-in works from `http://localhost:3000` only, not from a phone on your network.

### Production

The whole stack (Postgres, API, web) runs with Docker Compose:

```sh
cp .env.example .env   # then set POSTGRES_PASSWORD and BETTER_AUTH_SECRET (see the file)
pnpm prod:up           # build images and start; the web app is on http://localhost:3000
pnpm prod:logs         # follow logs
pnpm prod:down         # stop (data stays in the postgres-data volume)
```

Only the web app is published to the host; it forwards `/api/*` to the API. The API applies pending database migrations each time it starts. Set `WEB_PORT` in `.env` to use another port, and `BETTER_AUTH_URL` to the address people open the app at. For Google sign-in, register `<BETTER_AUTH_URL>/api/auth/callback/google` as a redirect URI too.

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
