# AGENTS.md

Guidance for AI coding agents working in this repo.

## Project

`buildinio` — an app builder for non-coders. Early stage: a landing page, working sign-up, log-in and accounts, a signed-in home with a sidebar, and project chats where an OpenAI model builds a real Vite + React app (writing files, running npm, searching the web) and the preview shows it. Playwright regression tests cover account popup layering, project header actions, the preview and the AI end to end (against a fake OpenAI). Update this file as the project grows.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, `lucide-react` icons, `sonner` toasts.
- SQLite (`better-sqlite3`) with Drizzle ORM; Arctic for Google/GitHub OAuth; Resend for email. Node.js 22+.
- The AI: OpenAI's Responses API (`openai` SDK), OpenAI models only. Users' apps start from `templates/app` (Vite, React, TypeScript, Tailwind v4) and their commands run in Docker (Playwright's image, for screenshots), or on the host with `SANDBOX=host`.
- Font: Onest (the brand wordmark font), loaded with `next/font/google`.

## Commands

- `npm install` — install dependencies
- `npm run dev` — dev server at http://localhost:3000
- `npm run build` — production build (also type-checks)
- `npm run lint` — ESLint
- `npm run test:e2e` — production Playwright regression tests; run `npx playwright install chromium` first, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an installed Chromium. Uses a separate `data/playwright.db` and `data/playwright-projects`, a fake OpenAI (`tests/fake-openai.mjs`, port 3101) and `SANDBOX=host`, so no key, Docker or network is needed. Seed data with `tests/seed.ts`.
- `npm run db:generate` — after changing `lib/db/schema.ts`, writes a migration to `drizzle/`. Migrations run on server start (`instrumentation.ts`).

## Layout

- `app/` — routes (`/` and `/projects/[id]` in the `(workspace)` route group, `/signup`, `/login`, `/welcome`, `/api/auth/[provider]/callback`, `/api/projects/[id]/turn` (sends a prompt and streams the AI's answer), `/preview/[id]/...` (the built app)), `layout.tsx` and `globals.css` (color tokens, light/dark, animations, fades).
- `components/` — React components (`Header`, `AppShell`, `Sidebar`, `Preview`, `ProjectList`, `ProjectTile`, `ProjectHeader`, `ProjectActions`, `EditProjectDialog`, `ProjectChat`, `ChatMessage`, `ChatTurn`, `MessageActions`, `AccountMenu`, `Hero`, `PromptBox`, `AuthFlow`, `CodeInput`, `ProviderIcons`, `Toaster`), hooks (`useKeyboardDock` keeps the prompt box and the name step above the phone keyboard; `useSidebarState`, `usePreviewState`, `useSwipeSheet`, `useStreamed`, `useScrollEdges`, `usePlayOnce`, `useCloseOnBackdrop`) and `styles.ts` (shared class strings like `focusRing`, `circleButton`, `navItem`, `menuPanel`, `dialogPanel`).
- `lib/projects/` — projects and chats: `server.ts` (database queries), `actions.ts` (Server Actions: edit, delete, feedback, preview seen), `store.ts` (the browser's copy, and playing back the AI's answers), `ids.ts`, `options.ts` (project colors and icons), `types.ts` (including the streamed `TurnEvent`s).
- `lib/ai/` — the AI: `client.ts` (OpenAI settings from env), `agent.ts` (one answer: the tool loop and the build), `tools.ts`, `instructions.ts` (its system prompt, and the project's state sent with each prompt), `skills.ts`, `naming.ts`, `runs.ts` and `registry.ts` (answers in progress, on the server).
- `skills/` — well-known public skills the AI reads when a request needs one (`frontend-design` from anthropics/skills, `web-design-guidelines` from vercel-labs, `shadcn` from shadcn-ui), copied as they are with their licenses. `skills/README.md` lists where each came from and how to add one. Excluded from type-checking, lint and Tailwind's class scan.
- `lib/sandbox/` — each project's code on disk: `workspace.ts` (folders, `PROJECTS_PATH`, default `data/projects`), `files.ts` (the AI's file tools, kept inside the folder), `run.ts` (commands in Docker or on the host), `build.ts` (`npm install` when needed, then `npm run build`), `look.ts` and `screenshot.mjs` (the AI's screenshots of the built app).
- `templates/app/` — what every new project starts as. Excluded from type-checking, lint and Tailwind's class scan.
- `lib/sidebar.ts` and `lib/preview.ts` — the sidebar's and the desktop preview's widths and cookie names, shared by the layout and the components.
- `lib/db/` — Drizzle schema and the database connection (`DATABASE_PATH`, default `data/buildinio.db`, gitignored). `drizzle/` holds the migrations. On start, `instrumentation.ts` also removes project folders whose project is gone.
- `lib/auth/` — sessions, Google/GitHub, email codes, sign-up, and `actions.ts` (the Server Actions the UI calls). `lib/email/` — the code email and sending.
- `proxy.ts` — sends signed-in users from `/signup`, `/login` and `/welcome` to `/`.
- `brand/` — logo and icons, imported directly (e.g. `import logo from "@/brand/logo.svg"`); don't copy them into `public/`. `logo-email.png` (on a white badge, for apps that force dark mode) and `logo-email-dark.png` (white, for real dark mode) are the logos rendered at 3× for emails (email apps don't show SVG).
- `public/avatars/default.svg` — the avatar for email sign-ups.

## Brand

- Logo files, colors and usage rules live in `brand/` (see `brand/README.md`). Use those files; don't redraw or recolor the logo.
- Page titles end in " - Buildinio": the root layout's `title.template` adds it, so pages set only their own part (`title: "Log in"`). The project chat swaps in the project's name (`ProjectChat`).
- UI colors are CSS variables in `app/globals.css` (`background`, `foreground`, `muted`, `surface`, `border`, `error`). Dark mode follows the system setting.

## Signed-in home

- `/` shows the landing page (`Header` + `Hero`) when signed out, and `AppShell` with the "New" tab (greeting + prompt box) when signed in.
- `(workspace)/layout.tsx` owns the signed-in `AppShell`, keeping the sidebar and account controls mounted between New and project chats. Pages render only their content; the shell reads the active project title from client route params. Menus and the phone sidebar close on navigation. Signed-out home still renders the landing page, and project pages still check authentication.
- Desktop (`md` and up): `DesktopSidebar` with the logo (turns into the toggle on hover), New and Search tabs, Projects (newest first; an empty state of faint ghost rows and "Your apps will show up here." when there are none), and the account row at the bottom. Drag its right edge to resize (180–400px); dragging under 140px collapses it to icons. Width and collapsed state are saved in the `sidebar_width` and `sidebar_collapsed` cookies, so the page renders at that size with no jump, and remembered through `useSidebarState` when the shared layout is hidden and restored. The project list's scroll position is shared the same way (in `ProjectList`).
- Phones: New and project chats share the circular sidebar button; New keeps the avatar. Project chats have a circular preview button and a rounded title menu; long titles end in an ellipsis with a down chevron. On every screen size, the rounded project title uses an ellipsis and down chevron and opens the shared Edit and Delete actions (`ProjectActions`). The title keeps an opaque tinted background on hover and while expanded; its chevron turns upward while open. The shared project menu keeps its original compact styling and is centered under the title. The preview button keeps the same colors when pressed. `MobileSidebar` slides over the whole screen, with the avatar floating at the bottom right.
- Preview (`Preview.tsx`): the built app in a sandboxed `<iframe>` (`/preview/<id>/index.html?v=<appVersion>`), loaded only in the panel or sheet that fits the screen; "Building your app" (a skeleton shimmering in a wave) while the AI works on a project with nothing built yet, and a quiet empty state otherwise. While the sidebar or preview edge is dragged, `[data-dragging]` on the root keeps the pointer out of the frame. On desktop, the header's preview button lines up with the prompt box's right edge (the header content is `max-w-2xl` like the prompt box) and toggles `DesktopPreview`, a panel right of the chat. Drag its left edge to resize (from 320px; the chat keeps 360px); dragging under 240px hides it, and its edge stays at the side of the screen to drag it back out. Starts hidden; width and open state are saved in the `preview_width` and `preview_open` cookies and shared through `usePreviewState`, like the sidebar. On phones the button slides `MobilePreview` over the whole screen from the right: a bar with the sidebar button, title and pressed preview button on a solid background, the app under it. Swiping left on the chat pulls it in and swiping right pushes it back out, following the finger (`useSwipeSheet`; the chat and the preview are `touch-pan-y touch-pinch-zoom` so sideways moves reach it). The app's frame keeps touches to itself, so swiping it out starts on a thin strip along its left edge. It closes on navigation, Escape, or when the screen gets wider; the sidebar slides over it.
- Account popups use a fixed portal outside the desktop sidebar, positioned from the trigger and kept within the viewport. In the phone sidebar, the portal stays in its dialog focus scope. Outside clicks, Escape, navigation, scrolling and resizing close the popup.
- Text that doesn't fit fades out with the `.fade-end` class (in `globals.css`) instead of ending in "…". It fades the element's last 2rem, so give it room (`flex-1`, or padding) or text that fits fades too.
- Scroll areas fade out what's scrolled past the same way: `.fade-y` + `useScrollEdges` (sidebar projects); the chat, which scrolls the page, uses background gradients under the header and above the prompt box. Every screen size uses the same gentle header fade with no solid color stop, like the fade by the prompt box.
- Hidden pages stay in the document (`cacheComponents`) and CSS animations replay when shown again, so "appear" animations use `usePlayOnce`, and only for things just made (`isNew` in the store).
- The Next.js dev badge is off (`devIndicators: false`) because every corner has a button under it.

## Projects and AI

- Projects and their chats are in the database (`projects`, `messages`); each project's code is a folder in `PROJECTS_PATH` (`data/projects/<id>`), kept until the project or the account is deleted. Deleting stops the AI if it's working on the project.
- The shared layout reads the user's projects (`listProjects`) and `AppShell` hands them to `lib/projects/store.ts`, a store outside React (`useSyncExternalStore`), so the shared sidebar and every chat see the same projects. Changes show right away and go to the server through `lib/projects/actions.ts`.
- Ids are made in the browser (`ids.ts`, 128 random bits), so a new chat opens at once. A project's id is also its preview's address, which needs no sign-in (the sandboxed frame sends no cookies), so it must stay long and random.
- A prompt on New creates a project and opens `/projects/[id]`; every prompt POSTs to `/api/projects/[id]/turn`, which creates the project the first time and streams the answer as NDJSON `TurnEvent`s. The answer runs on the server (`lib/ai/runs.ts`), not in the request: leaving or reloading doesn't stop or repeat it, and coming back joins in (a `snapshot` of what happened so far). An answer lost to a server restart starts again.
- The AI is set in `.env.local`: `OPENAI_API_KEY`, `OPENAI_MODEL` and optionally `OPENAI_REASONING_EFFORT` (passed on as is), plus `OPENAI_SMALL_MODEL` / `OPENAI_SMALL_REASONING_EFFORT` for naming. Without a key or model, every answer says how to set it up. API and sandbox failures end the answer with a short explanation (`problem` in `agent.ts`).
- The first prompt also names the project: a separate structured-output call (`naming.ts`, on the small model if set), alongside the answer; the name types itself out with its icon and color. A rename in the meantime wins.
- An answer: the AI says what it'll do, then uses its tools — web search (OpenAI's own, `search_context_size: "low"`), list/read/write/edit/delete files, run a command, load a skill — for as long as it needs, chaining requests with `previous_response_id`. It sees the chat so far (up to 50 messages, dropping the oldest 20 at a time) and the file tree. Questions get just an answer. It doesn't build the app itself: if the source files changed, the app is built after it finishes ("Building your app"); a failed build goes back to the AI to fix, twice at most.
- Cost: OpenAI caches a prompt by its start, so `INSTRUCTIONS` never changes (no file tree, no name: those go in a `developer` message just before the prompt, once per answer), every request sends `prompt_cache_key` (the project id), and the chat history's start only moves every 10 turns. The fake OpenAI in the tests answers "The instructions changed…" if that breaks. Each answer logs its requests and tokens (input, cached, output, reasoning) in the server console. Command output reaches the AI without color codes (`NO_COLOR`).
- Skills (`lib/ai/skills.ts`): the instructions list each skill in `skills/` by name and description; `load_skill` returns its `SKILL.md` (or another of its text files) and shows as "Reading up on frontend design". A `` !`command` `` line in a SKILL.md runs in the project's sandbox and its output takes its place (shadcn's `npx shadcn@latest info --json`). Read once at start, so restart after changing them.
- Apps are built from shadcn/ui parts: the AI runs `npx shadcn@latest init --base radix --preset <style> -y` in a new app (a style that suits it, so apps don't all look alike), adds the parts it needs, and sets the app's own colors, fonts and radius in `src/index.css`. The template has the `@/` → `src/` alias shadcn needs; the sandbox must reach `ui.shadcn.com`.
- `look_at_app` (`lib/sandbox/look.ts`): builds the app if it changed (the same `buildIfChanged` as the end of an answer, so it's not built twice), then `screenshot.mjs` runs where commands run (in Docker with the script and `playwright-core` mounted read-only), serves `dist/`, and takes a phone (390) and a desktop (1280) screenshot, at most two screens tall, with console errors and broken requests. Requests to this machine's network are blocked. The pictures go to the AI as `input_image`s, twice per answer at most, and stay in `dist/.look/` (not a source file, not served). No Chromium: the tool says so once and the AI carries on. Shows as "Looking at your app".
- In the chat it plays out like before: Thinking → what it says and the tools it uses (a box of rows: "Editing src/App.tsx +12 −3", a check or an X) → the steps fold away and what it said last stays as the answer. Text streams by the clock (`CHAR_MS` per letter), and the next step waits for it.
- A successful build bumps `appVersion` and sets `ready` until the preview is seen: desktop opens the preview if it's hidden; phones show a small "Your app is ready" pill above the prompt box with View (opens it) and an X to dismiss.
- Users' apps: `templates/app` (Vite + React + TypeScript + Tailwind v4 + lucide-react, `base: "./"`; no colors, fonts or components of ours: the AI picks a look per app; the prompt keeps apps to the words people need, with no hero, taglines or blurbs, and that wins over skills' hero and copy advice), built into `dist/` and served by `app/preview` with a CSP `sandbox` (its own origin, so its scripts can't reach this site; `localStorage` may not work there) and CORS for Vite's `crossorigin` scripts. Commands get 5 minutes; files 200 KB each and 5 MB in all; links out of the folder are refused. The Docker image is pulled in the background when the server starts (`prepareSandbox`), so the first build doesn't spend its time limit downloading it.
- Seconds tick while the AI works and stay next to like / dislike / copy under every answer. Like and dislike exclude each other; pressing the one that's on turns it off.
- User prompts sit on a tint of the project color; answers have no background.
- Sidebar rows: the ⋯ button shows on hover with a mouse and always on touch screens and in the phone sidebar. The name only makes room for it while it shows. It, right-click and a long press open Edit (name, color, icon) and Delete (asks first, like deleting the account). Clicking outside either dialog cancels it (`useCloseOnBackdrop`).

## Auth

- `/signup` and `/login` do the same thing; only the headings differ. Both render `AuthFlow` (start → email code → name). The server decides: an email with an account logs in, a new one creates an account.
- Accounts are matched by email, so one account works with Google, GitHub and email codes. Only verified provider emails are accepted.
- The name step only shows for new accounts. The account is created when the name is submitted (until then it's a `pending_signups` row). Google/GitHub sign-ups land on `/welcome` with the name filled in.
- Avatar is set once, at creation: the Google/GitHub picture, or `/avatars/default.svg` for email.
- Email codes: 6 digits, 10 minutes, one try each, at most 5 per email per hour.
- Sessions: random token in an httpOnly `session` cookie, only its SHA-256 stored, 30 days. Read the user with `getCurrentUser()` inside `<Suspense>` (it reads the request).
- Setup is in `.env.example` and the README. With no keys, email codes are printed in the server console (with a warning toast), and the Google/GitHub buttons show an error toast.
- Deleting the account deletes its projects too: their code first (`removeUserProjects`), then the rows with the user.
- `cacheComponents` keeps visited pages and layouts alive but hidden. `AuthFlow` resets when hidden; `AccountMenu`, `AppShell` and `ProjectList` also close transient controls when the pathname changes. Logging in or out purges the browser's page cache (`revalidatePath("/", "layout")`).

## How to work

- Keep responses short, direct, and easy to understand.
- When giving options, state your recommendation plus pros and cons for each.
- If anything is unclear, ask instead of guessing.
- Keep `AGENTS.md` and `CLAUDE.md` up to date whenever the project changes (stack, commands, conventions).

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
