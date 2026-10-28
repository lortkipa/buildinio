# Skills

Guides the AI that builds the apps can read when a request needs one (`lib/ai/skills.ts`). Its system prompt lists each skill's `name` and `description` from the `SKILL.md` frontmatter, and the `load_skill` tool reads the rest, so a skill only costs tokens in the answers that use it.

These are well-known public skills, copied as they are. Don't edit them here: update them from their source instead.

| Skill | Source | Commit | License |
| --- | --- | --- | --- |
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | `dbd4588` | Apache-2.0 (`LICENSE.txt`) |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) | `1a2c79d` | MIT |
| `web-design-guidelines/command.md` | [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md) | `434b7f9` | MIT (`LICENSE`) |
| `shadcn` | [shadcn-ui/ui](https://github.com/shadcn-ui/ui/tree/main/skills/shadcn) | `96da9cc` | MIT (`LICENSE.md`) |

`web-design-guidelines` fetches its rules from `command.md` online. The AI can't fetch pages, so a copy sits next to it.

`shadcn` drives the shadcn CLI (`npx shadcn@latest …`), which the AI runs with `run_command`. Its SKILL.md starts with `` !`npx shadcn@latest info --json` ``: like Claude Code, `lib/ai/skills.ts` runs that in the project and puts the output in its place.

## Adding or updating one

- Copy the skill's folder from its repo into `skills/<name>/`, with its license, and add a row above.
- Mind its size (it's sent to the AI every time it's loaded), and check its `description`: the AI loads a skill whenever the description matches the request. One that matches every request (like "use when writing React code") gets loaded in every answer.
- The AI only has the tools in `lib/ai/tools.ts`: files, commands, web search, and screenshots of the built app (`look_at_app`), but no browser to drive and no page fetching. A skill that needs those won't work.
- Restart the server: skills are read once.
