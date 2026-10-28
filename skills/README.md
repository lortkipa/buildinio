# Skills

Guides the AI that builds the apps can read when a request needs one (`lib/ai/skills.ts`). Its system prompt lists each skill's `name` and `description` from the `SKILL.md` frontmatter, and the `load_skill` tool reads the rest, so a skill only costs tokens in the answers that use it.

These are well-known public skills, copied as they are. Don't edit them here: update them from their source instead.

| Skill | Source | Commit | License |
| --- | --- | --- | --- |
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | `dbd4588` | Apache-2.0 (`LICENSE.txt`) |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) | `1a2c79d` | MIT |
| `web-design-guidelines/command.md` | [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md) | `434b7f9` | MIT (`LICENSE`) |

`web-design-guidelines` fetches its rules from `command.md` online. The AI can't fetch pages, so a copy sits next to it.

## Adding or updating one

- Copy the skill's folder from its repo into `skills/<name>/`, with its license, and add a row above.
- Keep it small, and check its `description`: the AI loads a skill whenever the description matches the request. One that matches every request (like "use when writing React code") gets loaded in every answer.
- The AI only has the tools in `lib/ai/tools.ts`: no browser, screenshots or page fetching. A skill that needs those won't work.
- Restart the server: skills are read once.
