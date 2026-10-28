<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/logo-dark.svg">
    <img src="brand/logo.svg" alt="buildinio" height="64">
  </picture>
</p>

<p align="center">An app builder for people who don't write code.</p>

## Run locally

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:3000. To try it on your phone, connect it to the same Wi-Fi and open `http://<your-computer's-IP>:3000`.

The database is a SQLite file (`data/buildinio.db`), created on first start. To have the AI build apps, see [AI setup](#ai-setup).

## Sign-in setup

Sign-up and log-in work without any setup: email codes are printed in the terminal, and the Google and GitHub buttons say they aren't set up yet. To turn them on, copy `.env.example` to `.env.local`, fill in the keys below and restart `npm run dev`.

- **Google**: in [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth client ID of type "Web application". Add `http://localhost:3000/api/auth/google/callback` as an authorized redirect URI. Put the ID and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- **GitHub**: in [GitHub Developer settings](https://github.com/settings/developers), create an OAuth App with the callback URL `http://localhost:3000/api/auth/github/callback`. Put the ID and secret in `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
- **Email**: create a [Resend](https://resend.com/api-keys) API key and put it in `RESEND_API_KEY`. To email anyone besides yourself, verify your domain in Resend and set `EMAIL_FROM` (like `buildinio <hello@yourdomain.com>`).

When deploying, set `APP_URL` to the public address and register the same callback paths on that address.

## AI setup

The AI that builds the apps is an OpenAI model. Without a key, every answer says so. In `.env.local`:

- `OPENAI_API_KEY`: from [OpenAI's API keys page](https://platform.openai.com/api-keys).
- `OPENAI_MODEL`: any model that works with the Responses API and function calling, like `gpt-6-luna`.
- `OPENAI_REASONING_EFFORT` (optional): how hard it thinks, like `low`, `medium` or `high`. Empty uses the model's default.
- `OPENAI_SMALL_MODEL` and `OPENAI_SMALL_REASONING_EFFORT` (optional): a cheaper model for quick side jobs, like naming a new project. Empty uses the main model.

Every answer logs what it cost in the server console, like `AI answer for 1a2b3c4d: 9 requests, 182,400 input tokens (164,100 cached), …`. Most of the input should be cached: the AI's instructions stay the same between requests so OpenAI's prompt cache can reuse them.

The AI can read up on design when a request needs it, using well-known public skills kept in [`skills/`](skills/).

Each project is a real Vite + React app, kept in `data/projects/<id>` until the project or the account is deleted. The AI installs packages and builds the app with npm, which runs in [Docker](https://docs.docker.com/get-docker/) by default: a throwaway container that only sees the app's folder. Have Docker running (the first build downloads the `node:22-slim` image). To skip Docker, set `SANDBOX=host`: commands then run straight on your computer, which is quicker to set up but gives the AI's code the same access you have.

Brand assets and usage rules are in [`brand/`](brand/).
