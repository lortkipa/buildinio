# For developers

Next.js 16, React 19, TypeScript, Tailwind CSS v4 and SQLite (Drizzle). The AI uses OpenAI's Responses API, with design skills from [`skills/`](../skills/). [`AGENTS.md`](../AGENTS.md) explains how it all fits together.

- `npm run dev`: the dev server at http://localhost:3000
- `npm run build`, then `npm run start`: a production build (`build` also type-checks)
- `npm run lint`: ESLint
- `npm run test:e2e`: the Playwright tests, against a fake OpenAI, so no key or Docker is needed. Run `npx playwright install chromium` first.
- `npm run db:generate`: after changing `lib/db/schema.ts`, writes a database migration

Brand assets and usage rules are in [`brand/`](../brand/).

To run it the way people trying it out do, see [Try it on your computer](run-locally.md); to host it, [Host it at home](hosting.md).
