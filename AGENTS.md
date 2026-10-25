# AGENTS.md

Guidance for AI coding agents working in this repo.

## Project

`buildinio` — an app builder for non-coders. Early stage: only a landing page so far, no tests yet. Update this file as the project grows.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, `lucide-react` icons.
- Font: Onest (the brand wordmark font), loaded with `next/font/google`.

## Commands

- `npm install` — install dependencies
- `npm run dev` — dev server at http://localhost:3000
- `npm run build` — production build (also type-checks)
- `npm run lint` — ESLint

## Layout

- `app/` — routes (`layout.tsx`, `page.tsx`) and `globals.css` (color tokens, light/dark).
- `components/` — React components (`Header`, `Hero`, `PromptBox`) and `useKeyboardDock` (keeps the prompt above the phone keyboard).
- `brand/` — logo and icons, imported directly (e.g. `import logo from "@/brand/logo.svg"`); don't copy them into `public/`.

## Brand

- Logo files, colors and usage rules live in `brand/` (see `brand/README.md`). Use those files; don't redraw or recolor the logo.
- UI colors are CSS variables in `app/globals.css` (`background`, `foreground`, `muted`, `surface`, `border`). Dark mode follows the system setting.

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
