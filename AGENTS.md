# AGENTS.md

Guidance for AI coding agents working in this repo.

## Project

`buildinio` — an app builder for non-coders. Early stage: a landing page plus working sign-up, log-in and accounts, no tests yet. Update this file as the project grows.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, `lucide-react` icons, `sonner` toasts.
- SQLite (`better-sqlite3`) with Drizzle ORM; Arctic for Google/GitHub OAuth; Resend for email. Node.js 22+.
- Font: Onest (the brand wordmark font), loaded with `next/font/google`.

## Commands

- `npm install` — install dependencies
- `npm run dev` — dev server at http://localhost:3000
- `npm run build` — production build (also type-checks)
- `npm run lint` — ESLint
- `npm run db:generate` — after changing `lib/db/schema.ts`, writes a migration to `drizzle/`. Migrations run on server start (`instrumentation.ts`).

## Layout

- `app/` — routes (`/` in `page.tsx`, `/signup`, `/login`, `/welcome`, `/api/auth/[provider]/callback`), `layout.tsx` and `globals.css` (color tokens, light/dark).
- `components/` — React components (`Header`, `HeaderAccount`, `AccountMenu`, `Hero`, `PromptBox`, `AuthFlow`, `CodeInput`, `ProviderIcons`, `Toaster`), `useKeyboardDock` (keeps the prompt box and the name step above the phone keyboard) and `styles.ts` (shared class strings like `focusRing`).
- `lib/db/` — Drizzle schema and the database connection (`DATABASE_PATH`, default `data/buildinio.db`, gitignored). `drizzle/` holds the migrations.
- `lib/auth/` — sessions, Google/GitHub, email codes, sign-up, and `actions.ts` (the Server Actions the UI calls). `lib/email/` — the code email and sending.
- `proxy.ts` — sends signed-in users from `/signup`, `/login` and `/welcome` to `/`.
- `brand/` — logo and icons, imported directly (e.g. `import logo from "@/brand/logo.svg"`); don't copy them into `public/`. `logo-email.png` is `logo.svg` rendered at 3× for emails (email apps don't show SVG).
- `public/avatars/default.svg` — the avatar for email sign-ups.

## Brand

- Logo files, colors and usage rules live in `brand/` (see `brand/README.md`). Use those files; don't redraw or recolor the logo.
- UI colors are CSS variables in `app/globals.css` (`background`, `foreground`, `muted`, `surface`, `border`, `error`). Dark mode follows the system setting.

## Auth

- `/signup` and `/login` do the same thing; only the headings differ. Both render `AuthFlow` (start → email code → name). The server decides: an email with an account logs in, a new one creates an account.
- Accounts are matched by email, so one account works with Google, GitHub and email codes. Only verified provider emails are accepted.
- The name step only shows for new accounts. The account is created when the name is submitted (until then it's a `pending_signups` row). Google/GitHub sign-ups land on `/welcome` with the name filled in.
- Avatar is set once, at creation: the Google/GitHub picture, or `/avatars/default.svg` for email.
- Email codes: 6 digits, 10 minutes, one try each, at most 5 per email per hour.
- Sessions: random token in an httpOnly `session` cookie, only its SHA-256 stored, 30 days. Read the user with `getCurrentUser()` inside `<Suspense>` (it reads the request).
- Setup is in `.env.example` and the README. With no keys, email codes are printed in the server console (with a warning toast), and the Google/GitHub buttons show an error toast.
- `cacheComponents` keeps visited pages alive but hidden, so `AuthFlow` and `AccountMenu` reset themselves when you leave the page. Logging in or out purges the browser's page cache (`revalidatePath("/", "layout")`).

## How to work

- Keep responses short, direct, and easy to understand.
- When giving options, state your recommendation plus pros and cons for each.
- If anything is unclear, ask instead of guessing.
- Keep `AGENTS.md` and `CLAUDE.md` up to date whenever the project changes (stack, commands, conventions).

## Pull requests

- Use a descriptive branch name (e.g. `feat/...`, `fix/...`, `docs/...`).
- After opening a PR, watch it: respond to review comments and fix failing CI.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
