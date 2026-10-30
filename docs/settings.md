# Settings

Settings are in the `.env.local` file in the `buildinio` folder (`npm run setup` makes it). Open it in any text editor; each setting has a note above it. After changing one, stop Buildinio (Ctrl+C) and start it again. Everything besides the AI is optional.

## The AI

The AI that builds the apps is an OpenAI model. Without a key, every answer says how to set it up.

- `OPENAI_API_KEY`: your key, from [OpenAI's API keys page](https://platform.openai.com/api-keys).
- `OPENAI_MODEL`: any model that works with the Responses API and function calling, like `gpt-6-luna`.
- `OPENAI_REASONING_EFFORT` (optional): how hard it thinks, like `low`, `medium` or `high`. Empty uses the model's default.
- `OPENAI_SMALL_MODEL` and `OPENAI_SMALL_REASONING_EFFORT` (optional): a cheaper model for quick side jobs, like naming a new project. Empty uses the main model.

What each answer cost is written in the terminal, like `AI answer for 1a2b3c4d: 9 requests, 182,400 input tokens (164,100 cached), …`. Most of it should be "cached", which OpenAI charges less for.

## Sign-in: Google, GitHub and email

Signing up and logging in work with no setup: the email codes are printed in the terminal, and the Google and GitHub buttons say they aren't set up yet. To turn them on:

- **Google**: in [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth client ID of type "Web application", with `<your address>/api/auth/google/callback` as an authorized redirect URI. Put its ID and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- **GitHub**: in [GitHub's developer settings](https://github.com/settings/developers), create an OAuth App with `<your address>/api/auth/github/callback` as the callback URL. Put its ID and secret in `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
- **Email**: create a [Resend](https://resend.com/api-keys) API key and put it in `RESEND_API_KEY`. That emails codes to your own Resend account's address only; to email anyone, verify your domain in Resend and set `EMAIL_FROM`, like `Buildinio <hello@example.com>`.

`<your address>` is `http://localhost:3000` on your computer, or your `https://` address when [hosting](hosting.md). Set `APP_URL` to the same address (the hosting script does that for you).

## Where the AI's commands run

Each project is a real Vite + React app. The AI installs packages and builds it with npm, and takes screenshots of it to fix what looks off. Those commands run:

- **In Docker** (`SANDBOX=docker`, the default): a throwaway container that only sees the app's own folder. It uses [Playwright's image](https://playwright.dev/docs/docker) (Node, npm, and the Chromium for screenshots), a big download that starts in the background when Buildinio starts.
- **On your computer** (`SANDBOX=host`): nothing to install, but the AI's code can reach whatever you can. Screenshots use the Chromium at `CHROMIUM_PATH`, or download Playwright's the first time.

Either way, they need to reach npm and [ui.shadcn.com](https://ui.shadcn.com), where the app's building blocks come from.

## Where your data is

Everything is in the `data` folder: the database (`data/buildinio.db`, or `DATABASE_PATH`) and each project's code (`data/projects/<id>`, or `PROJECTS_PATH`), kept until the project or its account is deleted. Back up that folder and `.env.local` to keep everything.
