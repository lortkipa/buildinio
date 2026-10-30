<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/logo-dark.svg">
    <img src="brand/logo.svg" alt="buildinio" height="64">
  </picture>
</p>

<p align="center">An app builder for people who don't write code.</p>

Describe the app you want in a chat, and an AI builds a real one: you watch it come together, try it out right there, and share it with a link.

## Two ways to run it

- **[Try it on your computer](#try-it-on-your-computer)**: a few minutes to set up, on Windows, Mac or Linux. It runs while the terminal window is open.
- **[Host it at home](docs/hosting.md)**: keep it running on a spare computer (an old laptop, a Raspberry Pi, a NAS) and open it from anywhere at an `https://` address, free or your own domain. One script sets it all up.

Either way, the AI runs on your own OpenAI account: you'll need an [API key](https://platform.openai.com/api-keys) with some credit on it.

## Try it on your computer

### 1. Install what it needs

- **Node.js 22 or newer**: from [nodejs.org](https://nodejs.org), the button that says LTS.
- **Docker Desktop**, recommended: from [docker.com](https://docs.docker.com/get-docker/), and keep it running. The AI builds each app inside it, sealed off from the rest of your computer. You can skip it: then the AI's commands run straight on your computer (you'll pick this in step 4).

### 2. Download Buildinio

On this page, click the green **Code** button, then **Download ZIP**, and unzip it. (Or, with Git: `git clone https://github.com/lortkipa/buildinio.git`.)

### 3. Open a terminal in the folder

- **Windows:** open the `buildinio` folder, right-click an empty spot and pick **Open in Terminal**.
- **Mac:** open the **Terminal** app, type `cd ` (with a space), drag the `buildinio` folder into the window and press Enter.
- **Linux:** right-click in the folder and pick **Open in Terminal**.

### 4. Set it up

```bash
npm run setup
```

It asks for your OpenAI key, the model and where the AI's commands run, then installs the rest (a minute or two). Press Enter to keep what's in [brackets].

What you type is saved in the `.env.local` file in the folder, and nowhere else. Rather fill that file in yourself? Copy `.env.example` to `.env.local`, add your key, and run `npm install` instead. Running `npm run setup` later keeps what's already there when you press Enter.

### 5. Start it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign up. Until email is set up, the sign-up code is printed in the terminal instead of emailed.

To stop it, press **Ctrl+C** in the terminal. To start it again later, open a terminal in the folder and run `npm run dev`.

**On your phone:** connect it to the same Wi-Fi and open `http://<your computer's IP>:3000`, like `http://192.168.1.20:3000`.

## Settings

Settings are in the `.env.local` file in the `buildinio` folder (`npm run setup` makes it). Open it in any text editor; each setting has a note above it. After changing one, stop Buildinio (Ctrl+C) and start it again. Everything besides the AI is optional.

### The AI

The AI that builds the apps is an OpenAI model. Without a key, every answer says how to set it up.

- `OPENAI_API_KEY`: your key, from [OpenAI's API keys page](https://platform.openai.com/api-keys).
- `OPENAI_MODEL`: any model that works with the Responses API and function calling, like `gpt-6-luna`.
- `OPENAI_REASONING_EFFORT` (optional): how hard it thinks, like `low`, `medium` or `high`. Empty uses the model's default.
- `OPENAI_SMALL_MODEL` and `OPENAI_SMALL_REASONING_EFFORT` (optional): a cheaper model for quick side jobs, like naming a new project. Empty uses the main model.

What each answer cost is written in the terminal, like `AI answer for 1a2b3c4d: 9 requests, 182,400 input tokens (164,100 cached), …`. Most of it should be "cached", which OpenAI charges less for.

### Sign-in: Google, GitHub and email

Signing up and logging in work with no setup: the email codes are printed in the terminal, and the Google and GitHub buttons say they aren't set up yet. To turn them on:

- **Google**: in [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth client ID of type "Web application", with `<your address>/api/auth/google/callback` as an authorized redirect URI. Put its ID and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- **GitHub**: in [GitHub's developer settings](https://github.com/settings/developers), create an OAuth App with `<your address>/api/auth/github/callback` as the callback URL. Put its ID and secret in `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
- **Email**: create a [Resend](https://resend.com/api-keys) API key and put it in `RESEND_API_KEY`. That emails codes to your own Resend account's address only; to email anyone, verify your domain in Resend and set `EMAIL_FROM`, like `Buildinio <hello@example.com>`.

`<your address>` is `http://localhost:3000` on your computer, or your `https://` address when [hosting](docs/hosting.md). Set `APP_URL` to the same address (the hosting script does that for you).

### Where the AI's commands run

Each project is a real Vite + React app. The AI installs packages and builds it with npm, and takes screenshots of it to fix what looks off. Those commands run:

- **In Docker** (`SANDBOX=docker`, the default): a throwaway container that only sees the app's own folder. It uses [Playwright's image](https://playwright.dev/docs/docker) (Node, npm, and the Chromium for screenshots), a big download that starts in the background when Buildinio starts.
- **On your computer** (`SANDBOX=host`): nothing to install, but the AI's code can reach whatever you can. Screenshots use the Chromium at `CHROMIUM_PATH`, or download Playwright's the first time.

Either way, they need to reach npm and [ui.shadcn.com](https://ui.shadcn.com), where the app's building blocks come from.

### Where your data is

Everything is in the `data` folder: the database (`data/buildinio.db`, or `DATABASE_PATH`) and each project's code (`data/projects/<id>`, or `PROJECTS_PATH`), kept until the project or its account is deleted. Back up that folder and `.env.local` to keep everything.

## Troubleshooting

- **`npm` isn't recognized / command not found:** install Node.js (step 1), then open a new terminal.
- **The AI says it isn't set up:** add your OpenAI key and model with `npm run setup`, then start Buildinio again.
- **The AI says Docker isn't installed or running:** start Docker Desktop, or run `npm run setup` and pick "straight on this computer".
- **Where's my sign-up code?** In the terminal where Buildinio runs, unless email is set up.
- **The AI's "Looked at your app" step shows an X:** the terminal says why.
- **Hosting at home?** See [its troubleshooting](docs/hosting.md#troubleshooting).

## For developers

Next.js 16, React 19, TypeScript, Tailwind CSS v4 and SQLite (Drizzle). The AI uses OpenAI's Responses API, with design skills from [`skills/`](skills/). [`AGENTS.md`](AGENTS.md) explains how it all fits together.

- `npm run dev`: the dev server at http://localhost:3000
- `npm run build`, then `npm run start`: a production build (`build` also type-checks)
- `npm run lint`: ESLint
- `npm run test:e2e`: the Playwright tests, against a fake OpenAI, so no key or Docker is needed. Run `npx playwright install chromium` first.
- `npm run db:generate`: after changing `lib/db/schema.ts`, writes a database migration

Brand assets and usage rules are in [`brand/`](brand/).
