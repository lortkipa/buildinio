# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Buildinio is an AI app builder for non-technical people, similar to Lovable or Replit. Users describe what they want, and Buildinio generates a working app with a live preview.

### Roadmap

- **Phase 1 (current):** a web platform that generates **frontend-only web apps**.
- **Later:** backends for generated apps (DB, auth, APIs), then generated desktop and mobile apps, then desktop and mobile clients for the Buildinio platform itself.

Build only what the current phase needs. For example, don't add backend, database or auth features to generated apps yet.

## Status

Scaffolded, with real accounts: sign-in with Google, GitHub or a code sent by email. The monorepo, web app, API and database are wired together. The web app has four pages:

- `/`: the landing page, a headline and a prompt input. Submitting a prompt and the plus and mic buttons all go to `/signup` (which sends signed-in users back home); the prompt itself is not kept yet. Signed out, the header links to `/login` and `/signup`. Signed in, the header shows only the logo and an account card (`app/account-card.tsx`) sits above the headline: avatar, name, email, Log out, and Delete account, which asks to confirm in a dialog. Better Auth only deletes after a sign-in within the last day; otherwise the dialog asks the user to log in again. A signed-in user who hasn't confirmed a name yet is sent to `/welcome`.
- `/login` and `/signup`: the same two-step sign-in (`AuthFlow`) with different text above the buttons, and a header linking to the other page. Signed-in users are sent to `/`. Errors show as a toast at the bottom of the screen (`app/toast.tsx`).
  - Continue with Google and Continue with GitHub: real sign-in through Better Auth. The button shows "Connecting…" and the browser goes to the provider. It comes back to `/welcome` for a new account, else to `/`. Without the provider's keys in `.env` (`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`), the toast says its sign-in isn't set up (in development, naming the keys). A cancelled or failed round trip comes back with `?error=`, shown as a toast. GitHub sign-in uses only an email GitHub has verified; without one it comes back with `?error=email_not_found`, and the toast asks to verify the email on GitHub.
  - Email and code steps: real sign-in with a code sent by email (`app/(auth)/email-code.ts`, Better Auth's emailOTP in the API). Email step: an empty or invalid address shows an error. A valid one sends a code and opens the code step on the same page; a failure (a limit, the email not sent, no connection) shows as a toast. Code step ("Check your email"): six digits, checked as soon as all are in. Each code allows 3 tries and expires after 10 minutes; every error says how many tries are left, as the API counts them. A new code can be sent once per 60 s, and going back and resending the same email can't skip that (the API answers for the code already sent). The header shows only Back. It, and the browser's or phone's Back, return to the email step (the step has its own history entry). A correct code signs in, creating the account for a new email, and goes to `/welcome` when the name isn't confirmed yet, else to `/`.
- `/welcome`: asked once, right after an account is created: "What should we call you?" The name field is prefilled with the name from Google or GitHub (the GitHub username when no name is set; empty for email accounts) and can be changed. Continue stays disabled while it is empty. Saving sets the name and `onboarded`, then goes to `/`. The header shows only the logo. Signed out, it redirects to `/login`; already named, to `/`.

Accounts are keyed by email: signing in with another provider that has the same email signs in to the same account and links that provider. The avatar is Google's or GitHub's picture when the account was created that way, else `/avatars/default.svg` (`apps/web/public/avatars/`, a Facebook-style silhouette). The name and avatar don't change when another provider is linked.

Email sign-in (`apps/api/src/email-sign-in.ts`): codes are sent over SMTP by Nodemailer (`mailer.ts`) as a branded email (`sign-in-email.ts`, the logo attached inline) and stored encrypted. Without `SMTP_HOST` and `EMAIL_FROM`, development prints the codes in the API's console and production refuses to start. A local Better Auth plugin in the same file adds limits on top of the code's expiry and tries: a resend cooldown per email, codes per email (a `+tag` counts as the same inbox), send requests and code checks per IP, and codes in total. A blocked request gets 429 with the code `EMAIL_LIMIT`, `IP_LIMIT` or `TOTAL_LIMIT` and `retryAfter`. The counters are in Postgres (`hitRateLimit` in `packages/db/src/rate-limit.ts`). The per-IP limits need the client's IP in `X-Forwarded-For`, which the web app's forwarding doesn't add; until a proxy in front sets it (replacing any client value), they are skipped. Better Auth's emailOTP endpoints other than sending a code are blocked (404), and its own rate limits on the two email paths are off.

The API serves Better Auth under `/api/auth/*` (`apps/api/src/auth.ts`), plus `GET /health` and `GET /status` (API and database reachability), which the web app doesn't call. The database has Better Auth's tables (`user` with an extra `onboarded` flag, `session`, `account`, `verification`) and `rate_limit_counter` for the email sign-in limits. There are no tests yet, and no generated-app template.

## Tech stack

### Platform (Buildinio itself)

| Area | Choice |
|---|---|
| Language | TypeScript |
| Monorepo | pnpm workspaces + Turborepo |
| Web app | Next.js (App Router) |
| API | Hono |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Better Auth (in the API; Google, GitHub and email-code sign-in) |
| Email | Nodemailer over SMTP (any provider; Brevo's free plan recommended) |
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

`assets/brand/` is the source of truth. The web app serves unchanged copies: the two logo SVGs in `apps/web/public/brand/` and the mark as the favicon in `apps/web/app/icon.svg`. The API has the dark-background logo PNG in `apps/api/assets/` for emails. If a brand file changes, copy it again.

In the web app, the five colors are Tailwind theme colors (`brand-amber`, `brand-coral`, `brand-magenta`, `brand-violet`, `brand-blue`), defined with the gradient utilities in `apps/web/app/globals.css`. Gabarito is loaded as `font-display` for headings. Light and dark mode follow the system setting (Tailwind's default `dark:` variant).

## Repository layout

```
assets/brand        Logo files (SVG and PNG), source of truth
apps/web            Next.js platform frontend (landing page at /, auth pages and /welcome in app/(auth))
apps/api            Hono API server (Better Auth at /api/auth/*, email sign-in, GET /health, GET /status, migrate entry); assets/ has the email images
packages/db         Drizzle client, schema, migrations, health check, drizzle.config.ts
packages/shared     Types shared across apps and packages (e.g. StatusResponse)
packages/tsconfig   Shared TypeScript config (@buildinio/tsconfig/base.json)
compose.yaml        Dev database (Postgres)
compose.prod.yaml   Production stack (Postgres + API + web)
.claude/launch.json Web and API dev servers for the Claude desktop app's browser preview
```

Planned, not created yet: `templates/` for the generated-app base template(s), and more `packages/*` (UI, config) as they are needed.

Notes:

- Browsers only talk to the web app. `apps/web/next.config.ts` rewrites `/api/*` to the API at `API_URL` (`apps/web/api-url.ts`, default `http://localhost:4000`), so sign-in cookies are first-party and there is no CORS. Better Auth's `BETTER_AUTH_URL` is therefore the web app's origin. Rewrites are fixed at build time: the web Dockerfile sets `API_URL=http://api:4000`, and `turbo.json` lists `API_URL` for the build task (Turborepo passes only declared variables).
- Auth in the web app: `app/auth-client.ts` (Better Auth's browser client, plus `settle` so a request that gets no answer fails like any other) and `app/session.ts` (`getSession()` for server components, which asks the API with the request's cookies). Pages guard themselves by calling `getSession()` and redirecting.
- Workspace packages export TypeScript source (no build step). The API bundles them with tsup. When the web app starts using one, add it to `transpilePackages` in `apps/web/next.config.ts` so Next.js compiles it.
- `next dev` serves its scripts only to localhost and to the origins in `allowedDevOrigins` (`apps/web/next.config.ts`, currently `192.168.*.*` and `10.*.*.*`). Opening the dev server from another hostname (another LAN range, a tunnel) needs an entry there, or the page won't hydrate.
- Icons are Lucide's, copied into `apps/web/app/icons.tsx`. `apps/web/app/pointer.ts` has `hasFinePointer`: fields focus themselves only with a mouse or trackpad, since on phones that would pop up the keyboard.
- Phone keyboards cover the page instead of resizing it. Forms in the web app call `revealForm` (`apps/web/app/reveal-form.ts`) on the visual viewport's `resize` event while a field is focused, so the submit button stays above the keyboard. Use it for new forms too.
- `apps/web/AGENTS.md` is written and kept up to date by `next dev`. Keep it committed and don't edit its managed block.
- Each app's Dockerfile uses `turbo prune`, so anything an app needs at build time must live in a workspace package, not at the repo root.
- The API reads `apps/api/assets/` at runtime from `../assets` relative to the running module (`src/` in development, `dist/` when built), and its Dockerfile copies the folder next to `dist/`. Keep modules that read assets directly in `src/`.

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
| `pnpm prod:up` | Build and start the production stack (needs `.env` with `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET`) |
| `pnpm prod:down` / `pnpm prod:logs` | Stop the production stack / follow its logs |

There are no tests yet. Add a `test` command here when the first tests land. In development, run `pnpm db:migrate` after creating or pulling a migration. In production, the API image applies pending migrations each time it starts (`apps/api/src/migrate.ts`, with the migrations copied to `MIGRATIONS_DIR`), before serving.

Environment variables: the root `.env` holds `DB_PORT` (dev database host port, read by `compose.yaml`, the API dev server and Drizzle Kit), the sign-in settings (`BETTER_AUTH_SECRET`, optional in dev and required in production; `BETTER_AUTH_URL`, the web app's public origin, default `http://localhost:3000`; `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`, each provider's sign-in is off without both of its keys), the email settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`; required in production) and email-code rules (`EMAIL_CODE_EXPIRES_MINUTES`, `EMAIL_CODE_MAX_TRIES`, `EMAIL_CODE_RESEND_SECONDS`, and the limits `EMAIL_CODE_LIMIT_PER_EMAIL`, `EMAIL_CODE_LIMIT_PER_IP`, `EMAIL_CODE_CHECK_LIMIT_PER_IP`, `EMAIL_CODE_LIMIT_TOTAL` written like `5/1h,10/1d` or `off`; bad values stop the API at startup), and `POSTGRES_PASSWORD` / `WEB_PORT` (production). The API reads `DATABASE_URL` (overrides the URL built from `DB_PORT`) and `PORT` (optional `apps/api/.env`). The web app reads `API_URL` (optional `apps/web/.env.local`). Dev defaults work without any env files, except for Google and GitHub sign-in (email codes are printed in the API's console). See the `.env.example` files.

## Working rules

- **Docs stay current.** Keep `CLAUDE.md` and all other documentation clean and up to date. Update them in the same change that alters structure, commands, stack or behavior. Remove anything stale.
- **Branch names** follow `<type>/<short-kebab-description>`, e.g. `feat/sandbox-preview` or `fix/preview-reload`. Allowed types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`. Never use random or auto-generated names.
- **Presenting options:** when offering choices, state a recommendation and give pros and cons for every option.
