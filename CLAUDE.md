# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Buildinio is an AI app builder for non-technical people, similar to Lovable or Replit. Users describe what they want, and Buildinio generates a working app with a live preview.

### Roadmap

- **Phase 1 (current):** a web platform that generates **frontend-only web apps**.
- **Later:** backends for generated apps (DB, auth, APIs), then generated desktop and mobile apps, then desktop and mobile clients for the Buildinio platform itself.

Build only what the current phase needs. For example, don't add backend, database or auth features to generated apps yet.

## Status

Pre-code. The repo holds only `LICENSE`. Fill in the **Repository layout** and **Commands** sections as soon as the project is scaffolded.

## Tech stack

### Platform (Buildinio itself)

| Area | Choice |
|---|---|
| Language | TypeScript |
| Monorepo | pnpm workspaces + Turborepo |
| Web app | Next.js (App Router) |
| API | Hono |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Better Auth |

### Generated apps (what users get)

| Area | Choice |
|---|---|
| Framework | React + Vite + TypeScript |
| Styling / UI | Tailwind CSS + shadcn/ui |
| Backend | None in Phase 1 (frontend only) |

### Sandbox and live preview

Generated apps run in **self-hosted containers** (Docker). Still open: the production isolation layer (e.g. gVisor or Firecracker) and the hosting choice.

## Repository layout (planned)

Not created yet. Update this section when the layout exists or changes.

```
apps/web       Next.js platform frontend
apps/api       Hono API server
packages/db    Drizzle schema and migrations
packages/*     Shared code (types, UI, config)
templates/     Base template(s) for generated apps
```

## Commands

None yet. Add install, dev, build, lint, test and DB commands here when the project is scaffolded.

## Working rules

- **Docs stay current.** Keep `CLAUDE.md` and all other documentation clean and up to date. Update them in the same change that alters structure, commands, stack or behavior. Remove anything stale.
- **Branch names** follow `<type>/<short-kebab-description>`, e.g. `feat/sandbox-preview` or `fix/preview-reload`. Allowed types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`. Never use random or auto-generated names.
- **Presenting options:** when offering choices, state a recommendation and give pros and cons for every option.
