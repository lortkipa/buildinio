# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Buildinio is an AI app builder for non-technical people, similar to Lovable or Replit. Users describe what they want, and Buildinio generates a working app with a live preview.

### Roadmap

- **Phase 1 (current):** a web platform that generates **frontend-only web apps**.
- **Later:** backends for generated apps (DB, auth, APIs), then generated desktop and mobile apps, then desktop and mobile clients for the Buildinio platform itself.

Build only what the current phase needs. For example, don't add backend, database or auth features to generated apps yet.

## Status

Scaffolded, with real accounts: sign-in with Google, GitHub or a code sent by email. The monorepo, web app, API and database are wired together. The web app has five pages:

- `/` signed out: the landing page, a headline, a short description and a prompt input. Submitting a prompt and the plus and mic buttons all go to `/signup`; the prompt itself is not kept yet. The header links to `/login` and `/signup`.
- `/` signed in: the home page, where a new project starts. `app/(main)/layout.tsx` puts it and the project pages in `app/app-shell.tsx` (the sidebar), which stays mounted while moving between them. A signed-in user who hasn't confirmed a name yet is sent to `/welcome`.
  - Center: the headline "Let’s build, {first name}." (the first word of the name, in the brand gradient) and the same prompt input. Sending it starts a project and opens its chat (mocked, see below). The mic button does nothing yet.
  - Attachments (`app/attachments.ts`, `app/attachment-tile.tsx`), in this prompt input and the chat's: the plus opens the system file browser, filtered to images and documents (PDF, Word, Excel, PowerPoint and their OpenDocument kinds, CSV, text, Markdown and code files). Files can also be dragged anywhere over the window (`app/file-drop.tsx`): a full-window overlay, "Drop files to attach", shows while they are over it (also over the preview), and dropping attaches them; not while a modal dialog is open, and the browser never opens a dropped file itself. Anything else is refused with a toast, as are a file over 25 MB, more than 20 files, or more than 100 MB in a message. The files show as 80 px square tiles in a row above the text, which scrolls sideways once they don't fit (also with the mouse wheel), fading out at an edge with more beyond it (`scroll-fade-x` in `globals.css`). An image shows itself; another file shows an icon and a format badge in its kind's color (PDF red, Word blue, sheets green, slides orange, code violet, text gray) and its name. An X at a tile's top right removes it, only on hover or focus with a mouse or trackpad and always on touch screens. Files alone can be sent, without text (the project is then "Untitled project"). Clicking an image, attached or already sent, opens it full size (`app/image-viewer.tsx`, a modal `<dialog>`), closing with the X at the top right, Escape or a click beside the image.
  - Sidebar, from `md` up (`app/sidebar.tsx`): the logo mark on top turns into a collapse/expand icon on hover and toggles the sidebar. Below it, New (a link to `/`) and Search (see below, with its shortcut shown on hover), then Projects (see below), then the user card at the bottom (avatar, name, email). Collapsed, it is a rail of icons with tooltips, without Projects, the card showing only the avatar. Its right edge can be dragged (or moved with the arrow keys when focused): 200 to 400 px wide, collapsing when dragged under 140 px and expanding when dragged back out. The width and collapsed state are kept in the `sidebar` cookie (`app/sidebar-state.ts`), which the layout reads, so it renders as the user left it.
  - Search (`app/search-dialog.tsx`) opens from Search in the sidebar, the collapsed rail or the phone sheet (above it), and with Ctrl+K or ⌘K on any signed-in page (not over a project's dialog). It is a modal dialog with a field and the projects matching it, newest first: by name first, then by a message in their chat, shown as a line of it ("You:" or "Buildinio:"). Matching ignores case and accents. The match is highlighted in the message's line, in the project's color; names aren't highlighted. Without a query it lists all projects as Recent. Up and Down move through the results (Enter opens one), as does hovering (a click opens it); opening one closes the dialog and the sheet. Escape, the close button or the backdrop close it, and each opening starts empty. It searches the mocked projects in the browser (`searchProjects` in `app/search.ts`) until projects live in the API.
  - Phones (below `md`): a top bar with a sidebar button on the left and the avatar on the right (on a project's page, its name in the middle and the preview button in place of the avatar). The button opens a full-screen sheet (a modal `<dialog>`) sliding in from the left: the logo with the name, a close button, New, Search and Projects, and the avatar floating over the bottom right of Projects (which leaves room after the last project, so it can scroll clear of the avatar). It closes with its button, Escape, tapping New or a project, or when the screen gets wide enough for the sidebar.
  - The user card, the collapsed avatar, the phone avatar (on the home page) and the avatar in the sheet open the same account menu (`app/user-menu.tsx`, a native popover, with name and email on top when only the avatar is shown): Settings (see below), Send feedback (which does nothing yet) and Log out, which goes back to the signed-out landing page.
  - Settings (`app/settings-dialog.tsx`), from the account menu: a modal dialog over the page from `md` up, its tabs in a left column, and full screen on phones, its tabs a row of chips under the title that scrolls sideways (a picked chip scrolls into view). Arrow keys, Home and End move between tabs. Each opening starts on Profile with nothing changed; what was typed stays while switching tabs. The tabs:
    - Profile (`app/settings-profile.tsx`): the photo (Change photo picks a JPG, PNG, GIF or WebP up to 5 MB, shown as a blob URL; Remove goes back to the silhouette), the name, and the email, which can't be changed. Save turns on once something changed, and Cancel puts it back.
    - General (`app/settings-general.tsx`): the theme, as System, Light and Dark cards with a small drawing of the app, and the language, 14 languages each in its own script, picked from a styled list (`app/select.tsx`, a listbox in a popover under the field, or above it without room: arrow keys, Home, End and typing the start of a name move through it, Enter or a click picks, and it closes when the window resizes or the page under it scrolls).
    - Notifications (`app/settings-notifications.tsx`): email switches: Your app is ready, Product updates and Tips and ideas.
    - Account (`app/settings-account.tsx`): the devices the user is logged in on (this one named from the browser's user agent, the others mocked in `app/mock-settings.ts`), and Delete account.

    Only deleting the account works. The rest shows its state but saves nothing: Save, Log out on a device, and the theme and language change nothing yet (the page follows the system's theme, as every `dark:` style is media-based). Delete account opens a confirmation over the settings: typing the account's email (any case) turns on Delete, which calls Better Auth's `deleteUser` (the sessions and linked sign-ins go with the user) and loads `/` signed out. Without a password, Better Auth deletes only from a session started within the last day; an older one gets `SESSION_EXPIRED`, and the confirmation asks to log in again (Log in again logs out and goes to `/login`).
  - Projects (`app/project-list.tsx`), in the sidebar and the sheet: newest first, each with its icon (a glyph in the project's color on a tint of it, `app/project-icon.tsx`) and name, the open one highlighted. The list scrolls under its heading and fades out at an edge with more beyond it (`scroll-fade-edges` in `globals.css`, `app/scroll-fade.ts`). A three-dot button on the right (always shown on touch screens, only on hover or focus with a mouse or trackpad) and a right-click open the project's menu (`app/project-menu.tsx`, a native popover): Edit, with an arrow, and Delete. With a mouse or trackpad, Edit's options (Icon and Name) open in a submenu beside the menu on hover, click or the Right arrow; on touch screens they slide over the menu, with a way back. Icon (an icon and a color), Name and Delete each open a modal dialog over a dark blurred backdrop (`app/project-dialogs.tsx`). Deleting the open project goes back to `/`.
- `/projects/[id]`: a project's chat (`app/project-chat.tsx`) and its preview (`app/preview-panel.tsx`), laid out by `app/project-workspace.tsx`, with the project's name in the middle of a top bar over the chat on every screen size. The name, with a down arrow and a highlight on hover, opens the same project menu as in the sidebar (Edit and Delete), centered under it. The user's messages sit on the right on a tint of the project's color, with their files as tiles above them (no bubble when only files were sent), the AI's are plain text, and there are no avatars. Only the messages scroll (with a styled scrollbar), up under the top bar, which floats over them, and fade out at the top and bottom edges into the background. Under the AI's messages are Like, Dislike and Copy, always shown; under the user's, Copy, always shown on touch screens and only on hover with a mouse or trackpad, and missing when only files were sent (`app/message-actions.tsx`). Like fills, pops and bursts into brand-colored dots; Dislike fills, drops and wobbles. Both stay shown: picking one takes the other back, and pressing the picked one again clears it. Copy turns into a check with a "Copied" label (it also copies on plain http, e.g. from a phone on the local network). The prompt input stays at the bottom, with attachments as on the home page: sending adds the message, three bouncing dots, then a canned reply. Signed out, it redirects to `/login`; a project that doesn't exist sends the user to `/`.
  - Preview, from `md` up: a panel to the right of the chat. A button at the right end of the top bar, above the prompt input's right end, shows and hides it (the width animates). Its left edge can be dragged (or moved with the arrow keys when focused, Enter toggling): the chat and the panel each keep at least 360 px (in a window too narrow for both, they split it evenly), and the panel hides when dragged under 240 px and shows again when dragged back out, also from the right edge while hidden. Its share of the width and whether it shows are kept in the `preview` cookie (`app/preview-state.ts`), which the layout reads, so every project opens with the panel as the user left it.
  - Preview, on phones: the button in place of the avatar switches between the chat and the preview, which fills the space under the top bar. The preview slides in from the right as a rounded card while the chat recedes to the left, shrinking and fading, and going back to the chat reverses it. Each project opens on its chat.
  - The preview's toolbar sits on top from `md` up and at the bottom on phones: a device button cycling Desktop, Tablet and Mobile on desktops (`lg` and up) and only Tablet and Mobile on tablets (`md` to `lg`, starting on Tablet), and missing on phones, where the app fills the screen (Desktop fills the panel; Tablet and Mobile are 768 and 390 px wide, scaled down when the panel is narrower), the page the app is on, which can be typed over and sent with Enter to go to another (Escape puts it back), and Open in a new tab, which does nothing yet. The app runs in a sandboxed iframe that posts its route to the panel and takes `navigate` messages.
- `/login` and `/signup`: the same two-step sign-in (`AuthFlow`) with different text above the buttons, and a header linking to the other page. Signed-in users are sent to `/`. Errors show as a toast at the bottom of the screen (`app/toast.tsx`).
  - Continue with Google and Continue with GitHub: real sign-in through Better Auth. The button shows "Connecting…" and the browser goes to the provider. It comes back to `/welcome` for a new account, else to `/`. Without the provider's keys in `.env` (`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`), the toast says its sign-in isn't set up (in development, naming the keys). A cancelled or failed round trip comes back with `?error=`, shown as a toast. GitHub sign-in uses only an email GitHub has verified; without one it comes back with `?error=email_not_found`, and the toast asks to verify the email on GitHub.
  - Email and code steps: real sign-in with a code sent by email (`app/(auth)/email-code.ts`, Better Auth's emailOTP in the API). Email step: an empty or invalid address shows an error. A valid one sends a code and opens the code step on the same page; a failure (a limit, the email not sent, no connection) shows as a toast. Code step ("Check your email"): six digits, checked as soon as all are in. Each code allows 3 tries and expires after 10 minutes; every error says how many tries are left, as the API counts them. A new code can be sent once per 60 s, and going back and resending the same email can't skip that (the API answers for the code already sent). The header shows only Back. It, and the browser's or phone's Back, return to the email step (the step has its own history entry). A correct code signs in, creating the account for a new email, and goes to `/welcome` when the name isn't confirmed yet, else to `/`.
- `/welcome`: asked once, right after an account is created: "What should we call you?" The name field is prefilled with the name from Google or GitHub (the GitHub username when no name is set; empty for email accounts) and can be changed. Continue stays disabled while it is empty. Saving sets the name and `onboarded`, then goes to `/`. The header shows only the logo. Signed out, it redirects to `/login`; already named, to `/`.

Projects and chats are mocked in the browser's memory (`app/projects.ts`, demo content in `app/mock-projects.ts`), and nothing reaches the API. Every page load starts from the same 12 demo projects, so new projects, renames, reactions, deletions and attached files are lost on reload. Attached files are kept as blob URLs (freed when removed from the input or when their project is deleted). A new project shows a shimmer in place of its icon and name until the mock AI names it from the prompt, about 2 s later, and gets its first reply after about 3.5 s. The preview shows a mock app (`app/mock-preview.ts`): one small site per project, in its name and color with its prompt as the tagline (a stock line when it started with files alone), with Home, Features, About and a 404 for other paths, and light and dark mode. Over it is a page-shaped shimmer (generic, not the app's shape): "Building your app…" until the first reply, then "Starting your app…" for about 1.2 s once the app exists (when a project opens, or after a new one's first reply), fading into the app when that time is up and the frame has loaded. The page field stays disabled until then. A rename or a new color rebuilds the app without the shimmer.

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

`assets/brand/` is the source of truth. The web app serves unchanged copies: the two logo SVGs and the mark in `apps/web/public/brand/` and the mark as the favicon in `apps/web/app/icon.svg`. The API has the dark-background logo PNG in `apps/api/assets/` for emails. If a brand file changes, copy it again.

In the web app, the five colors are Tailwind theme colors (`brand-amber`, `brand-coral`, `brand-magenta`, `brand-violet`, `brand-blue`), defined with the gradient utilities in `apps/web/app/globals.css`. Gabarito is loaded as `font-display` for headings. Light and dark mode follow the system setting (Tailwind's default `dark:` variant).

## Repository layout

```
assets/brand        Logo files (SVG and PNG), source of truth
apps/web            Next.js platform frontend (landing, home and project chat in app/(main), auth pages and /welcome in app/(auth))
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
- `next dev` serves its scripts only to localhost and to the origins in `allowedDevOrigins` (`apps/web/next.config.ts`, currently `192.168.*.*` and `10.*.*.*`). Opening the dev server from another hostname (another LAN range, a tunnel) needs an entry there, or the page won't hydrate. Sign-in from those addresses also needs the origin in `LAN_DEV_ORIGINS` (`apps/api/src/auth.ts`, development only), or Better Auth refuses it with `INVALID_ORIGIN`.
- Modal dialogs (the project dialogs, search, settings) use `Dialog` (`apps/web/app/dialog.tsx`): a dark blurred backdrop, closing with Escape or a click on it, rising above a phone keyboard (it sets `--keyboard-inset` on itself), and focusing a field with `data-autofocus` only with a mouse or trackpad. The same file has their title and button styles (`DIALOG_TITLE`, `PRIMARY_BUTTON`, `CANCEL_BUTTON`, `DANGER_BUTTON`, `SECONDARY_BUTTON`). AppShell renders them after the phone sheet, so they open above it. A dialog that opens over another (deleting the account over settings) is rendered beside it, not inside it, since React passes a dialog's `onClose` up to the dialogs around it. Errors in a dialog show inside it: the toast isn't in the top layer, so it would sit behind the dialog.
- Tooltips are styled, not the browser's: give an element `data-tooltip` (and its own `aria-label`) instead of `title`. `apps/web/app/tooltips.tsx`, mounted once in the root layout, shows it after a short hover with a mouse or trackpad, or on keyboard focus, above the element (below without room above) or, with `data-tooltip-side="right"`, to its right. It is one popover in the top layer, so nothing clips it.
- Icons are Lucide's, copied into `apps/web/app/icons.tsx`. `apps/web/app/pointer.ts` has `hasFinePointer`: fields focus themselves only with a mouse or trackpad, since on phones that would pop up the keyboard. Controls that show only on hover with a mouse (a project's three dots, Copy under the user's messages) use Tailwind's `pointer-fine:` variant, so touch screens always show them.
- `md` is the line between phones and wider screens. Styles use `md:` and `max-md:` classes; what CSS can't do (e.g. `inert`, labels, the preview's device options) uses `useWide` and `useLarge` (`lg`, desktops) in `apps/web/app/wide.ts`. The sidebar and the preview share their drag handle (`apps/web/app/resize-handle.tsx`) and cookie saving (`apps/web/app/save-cookie.ts`).
- Phone keyboards cover the page instead of resizing it. Forms in the web app call `revealForm` (`apps/web/app/reveal-form.ts`) on the visual viewport's `resize` event while a field is focused, so the submit button stays above the keyboard. Use it for new forms too. A form in a modal dialog is fixed in place, so the project dialogs instead raise their bottom edge above the keyboard (`Dialog` in `app/project-dialogs.tsx`).
- `next dev`'s badge sits bottom right (`devIndicators` in `apps/web/next.config.ts`), so it doesn't cover the sidebar's user card.
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
