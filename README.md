<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/buildinio-logo-dark-bg.svg">
    <img src="assets/brand/buildinio-logo-light-bg.svg" alt="Buildinio" width="360">
  </picture>
</p>

<p align="center">An AI app builder for non-technical people. Describe what you want, get a working app with a live preview.</p>

## Status

Early development. Phase 1 generates frontend-only web apps (React, Vite, Tailwind CSS, shadcn/ui).

The platform is scaffolded: a Next.js web app, a Hono API and a PostgreSQL database. For now the web app has a landing page with the prompt input, and accounts: sign-in with Google, GitHub or a code sent by email, and a name step for new accounts. Signed in, the home page has the prompt input, a resizable sidebar (New, Search, Projects) and an account menu with Log out; on phones, the sidebar opens as a full-screen sheet. Generating apps is not built yet.

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

#### GitHub sign-in

Without keys, "Continue with GitHub" says that it isn't set up. To turn it on:

1. On GitHub, go to [Settings > Developer settings > OAuth Apps](https://github.com/settings/developers) and create a new OAuth app.
2. Use `http://localhost:3000` as the homepage URL and `http://localhost:3000/api/auth/callback/github` as the authorization callback URL. An OAuth app has only one callback URL, so create a separate app for production.
3. Generate a client secret, put the keys in the root `.env`, then restart `pnpm dev`:

   ```sh
   GITHUB_CLIENT_ID=...
   GITHUB_CLIENT_SECRET=...
   ```

Like Google sign-in, it works from `http://localhost:3000` only in development. It signs in with the email GitHub has verified; a GitHub account without one is asked to verify it first.

#### Email sign-in

Works without any setup: "Continue with email" sends nothing in development and prints the code in the API's output instead (`Sign-in code for you@example.com: 123456`).

To send real emails, set an SMTP provider in the root `.env` and restart `pnpm dev`. `.env.example` walks through [Brevo](https://www.brevo.com), whose free plan sends 300 emails a day:

```sh
SMTP_HOST=smtp-relay.brevo.com
SMTP_USER=...
SMTP_PASSWORD=...
EMAIL_FROM="Buildinio <no-reply@yourdomain.com>"
```

Codes expire after 10 minutes, allow 3 wrong tries, and a new one can be sent after 60 seconds. Codes per email, per IP and in total are limited too. Every rule can be changed in `.env` (see `.env.example`).

### Production

The whole stack (Postgres, API, web) runs with Docker Compose:

```sh
cp .env.example .env   # then set POSTGRES_PASSWORD, BETTER_AUTH_SECRET and the SMTP settings (see the file)
pnpm prod:up           # build images and start; the web app is on http://localhost:3000
pnpm prod:logs         # follow logs
pnpm prod:down         # stop (data stays in the postgres-data volume)
```

Only the web app is published to the host; it forwards `/api/*` to the API. The API applies pending database migrations each time it starts. Set `WEB_PORT` in `.env` to use another port, and `BETTER_AUTH_URL` to the address people open the app at. For Google sign-in, register `<BETTER_AUTH_URL>/api/auth/callback/google` as a redirect URI too. For GitHub sign-in, create a production OAuth app with the callback URL `<BETTER_AUTH_URL>/api/auth/callback/github`.

Email sign-in is required in production: the API doesn't start without `SMTP_HOST` and `EMAIL_FROM`. The per-IP limits on email codes need the visitor's IP in `X-Forwarded-For`, which the web app doesn't add on its own. Until a proxy in front of it sets that header to the visitor's IP, replacing any value the visitor sent (e.g. nginx with `proxy_set_header X-Forwarded-For $remote_addr;`), those limits are off. The per-email and total limits work either way.

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
