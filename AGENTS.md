# AGENTS.md

Guidance for AI coding agents working in this repo. Keep it short: describe what isn't obvious from the code, and update it when the project changes.

## Project

`buildinio` is an app builder for non-coders. People sign up, describe an app in a chat, and an OpenAI model builds a real Vite + React app (writing files, running npm, searching the web). The preview shows the app, and a share link opens it on its own (private or public).

## Stack

- Next.js 16 (App Router, `cacheComponents`), React 19, TypeScript, Tailwind CSS v4, `lucide-react`, `sonner`. Font: Onest.
- SQLite (`better-sqlite3`) + Drizzle ORM. Arctic for Google/GitHub OAuth, Resend for email. Node.js 22+.
- AI: OpenAI's Responses API (`openai` SDK), OpenAI models only.
- Users' apps start from `templates/app` (Vite, React, TypeScript, Tailwind v4) and their commands run in Docker (Playwright's image) or, with `SANDBOX=host`, on the host.
- Answers are Markdown: `react-markdown` + `remark-gfm`, code colored with `lowlight`.

## Commands

- `npm install`, `npm run dev` (http://localhost:3000), `npm run build` (also type-checks), `npm start`, `npm run lint`.
- `npm run db:generate`: after changing `lib/db/schema.ts`, writes a migration to `drizzle/`. Migrations run on server start (`instrumentation.ts`).
- `npm run test:e2e`: Playwright against a production build. Run `npx playwright install chromium` first (or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`). Uses its own `data/playwright.db` and `data/playwright-projects`, a fake OpenAI (`tests/fake-openai.mjs`, port 3101) and `SANDBOX=host`, so no key, Docker or network is needed. Seed data with `tests/seed.ts`.

## Layout

- `app/` — routes. `(workspace)/` holds `/` and `/projects/[id]` under the shared signed-in shell. Also `/signup`, `/login`, `/welcome`, `/preview/[id]/...` (the built app), `/share/[id]` (the app on its own) and `api/` (OAuth callbacks, `projects/[id]/turn` (streams an answer), `share/[id]` (server-sent events), `attachments`, `avatars`, `account/export`). `globals.css` has the color tokens, light/dark and animations.
- `components/` — React components and hooks. `styles.ts` has shared class strings (`focusRing`, `menuPanel`, `dialogPanel`, …).
- `lib/projects/` — projects and chats: `server.ts` (queries), `actions.ts` (Server Actions), `store.ts` (the browser's copy), `types.ts` (including the streamed `TurnEvent`s), plus search, questions, attachments and share-page changes.
- `lib/ai/` — `agent.ts` (one answer: the tool loop and the build), `tools.ts`, `instructions.ts` (system prompt), `skills.ts`, `naming.ts`, `runs.ts` / `registry.ts` (answers in progress), `client.ts` (env settings).
- `lib/sandbox/` — each project's folder (`PROJECTS_PATH`, default `data/projects`): file tools, `run.ts` (Docker or host), `build.ts`, `look.ts` (screenshots), `snapshot.ts` (undo for Stop), `attachments.ts`.
- `lib/auth/`, `lib/email/`, `lib/account/` — sign-in, sessions, the code email, and the settings.
- `lib/db/` — schema and connection (`DATABASE_PATH`, default `data/buildinio.db`). `drizzle/` — migrations.
- `proxy.ts` — runs for every page: redirects signed-in users away from auth pages and keeps the `theme` cookie in sync with the database.
- `skills/` — public AI skills copied as they are (see `skills/README.md`). Don't edit them.
- `templates/app/` — what every new project starts as.
- `brand/` — logo and icons (see `brand/README.md`). `skills/` and `templates/app/` are excluded from type-checking, lint and Tailwind's class scan.

## UI conventions

- Use the files in `brand/` as they are, imported directly (`import logo from "@/brand/logo.svg"`); don't copy them into `public/` or recolor them.
- Page titles: set only the page's part (`title: "Log in"`); the root layout adds " - Buildinio".
- Colors are CSS variables in `app/globals.css` (`background`, `foreground`, `muted`, `surface`, `border`, `error`, `tooltip`). Use them, not raw colors.
- Theme: the user's choice (`system`, `light`, `dark`) is in the database. Only the server writes the `theme` cookie (`proxy.ts`). `data-theme` on `<html>` is only ever `light` or `dark`; `system` is resolved in the browser (root layout script and `useApplyTheme`).
- Hidden pages stay mounted (`cacheComponents`) and CSS animations replay when shown again. Use `usePlayOnce` for "appear" animations, and reset or close transient UI when the pathname changes.
- Text that doesn't fit fades with `.fade-end` (it fades the last 2rem, so give it room). Scroll areas fade with `.fade-y` / `.fade-x` + `useScrollEdges`.
- Pop-ups (settings, search, menus, tooltips) are portaled to `<body>`, or into the open `<dialog>`.
- `useKeyboardDock` keeps the prompt box and other inputs above the phone keyboard.
- The prompt box edits text with `execCommand("insertText")` so Undo keeps working.

## How it works

- **Data flow**: the layout reads the user's projects and hands them to `lib/projects/store.ts` (a `useSyncExternalStore` store), so the sidebar and every chat share one copy. Changes show at once and are saved through Server Actions. Account settings work the same way (`lib/account/store.ts`).
- **Ids** are made in the browser (`lib/projects/ids.ts`, 128 random bits). A project's id is also its preview and share address, and the app's files there need no sign-in, so ids must stay long and random.
- **Answers** run on the server (`lib/ai/runs.ts`), not in the request: leaving or reloading doesn't stop them, and coming back joins in. The turn route streams NDJSON `TurnEvent`s. An answer cut off by a restart starts again.
- **The AI** uses web search, file tools, commands, skills, screenshots (`look_at_app`) and `ask_user` (questions). The app is built after an answer if source files changed; a failed build goes back to the AI twice at most. It identifies itself as Buildinio's assistant (`instructions.ts`).
- **Prompt cache**: `INSTRUCTIONS` must never change between requests. Per-answer state (file tree, name) goes in a `developer` message just before the prompt. The fake OpenAI answers "The instructions changed…" if this breaks.
- **Stop** undoes the whole answer: the project folder is snapshotted before each answer (without `node_modules` and `attachments/`), and Stop restores it, restores the name/icon/color, and deletes the prompt (which goes back into the prompt box).
- **Preview and share**: built apps are served from `/preview/<id>/` with a CSP `sandbox` (their own origin, no cookies). `projects.visibility` is `private` (owner only) or `public`; `/preview` checks the same rule for app pages (`getSharedApp`). Share pages update live through `announceChange` + `/api/share/<id>`.
- **Attached files** stay in the browser until the prompt is sent, then are stored as blobs with the message (10 per prompt, 10 MB each). Before each answer they're copied into the project's `attachments/`, which isn't source.
- **Sandbox limits**: commands get 5 minutes; source files 200 KB each and 5 MB in all; links out of the project folder are refused.

## Auth

- `/signup` and `/login` are the same flow (`AuthFlow`: start → email code → name). An email with an account logs in; a new one signs up.
- Accounts are matched by verified email across Google, GitHub and email codes.
- Email codes: 6 digits, 10 minutes, one try each, 5 per email per hour. Without `RESEND_API_KEY` they're printed in the server console.
- Sessions: random token in an httpOnly `session` cookie (only its SHA-256 is stored), 30 days. Read the user with `getCurrentUser()` inside `<Suspense>`.
- Deleting an account deletes its projects' folders first, then the rows.

## Tests

The fake OpenAI reacts to words in the prompt: "Markdown" (answers `tests/markdown-sample.md`), "attached" (lists the files it got), "slowly" and "hold on" (for Stop tests), "ask me" (asks two questions).

## How to work

- Keep responses short, direct and easy to understand.
- When giving options, state your recommendation plus pros and cons for each.
- If anything is unclear, ask instead of guessing.
- Keep `AGENTS.md` up to date when the project changes (stack, commands, conventions). `CLAUDE.md` only points here.

## Branches

- Work on a descriptive branch: `feat/...`, `fix/...` or `docs/...` (e.g. `feat/sidebar`). Never commit to `main` or to an auto-named `claude/...` branch.
- If your session starts on a `claude/...` branch, create the descriptive branch from the latest `main` before your first commit and push it with `git push -u origin <name>`. This is the owner's explicit permission to push there instead of the assigned branch.

## Pull requests

- After opening a PR, watch it: respond to review comments and fix failing CI.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
