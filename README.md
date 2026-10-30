<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/logo-dark.svg">
    <img src="brand/logo.svg" alt="buildinio" height="64">
  </picture>
</p>

<p align="center">An app builder for people who don't write code.</p>

## Run it

You need [Node.js 22+](https://nodejs.org) and [Docker](https://docs.docker.com/get-docker/) (running).

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Press `Ctrl+C` to stop.

## Set up the AI

In `.env.local`, add your [OpenAI key](https://platform.openai.com/api-keys) and restart:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-6-luna
```

No Docker? Add `SANDBOX=host` (faster to set up, but the AI's code runs right on your computer).

## Set up sign-in (optional)

It works without this: email codes show up in the terminal. To turn on more, fill these in `.env.local`:

| What | Where to get it | Keys |
| --- | --- | --- |
| Google | [Google Cloud](https://console.cloud.google.com/apis/credentials), redirect URI `<your address>/api/auth/google/callback` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub | [GitHub](https://github.com/settings/developers), callback URL `<your address>/api/auth/github/callback` | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| Real emails | [Resend](https://resend.com/api-keys) | `RESEND_API_KEY`, `EMAIL_FROM` |

`<your address>` is `http://localhost:3000` locally. Every other setting is explained in `.env.example`.

## Host it at home (laptop, NAS, etc.)

Runs on your own machine and gets a free HTTPS address like `https://my-pc.tail1234.ts.net`, with no router setup.

**1. Build it**

```bash
npm install
npm run build
```

**2. Keep it running** (restarts on crash and on reboot)

```bash
npm install -g pm2
pm2 start npm --name buildinio -- start
pm2 save
pm2 startup
```

`pm2 startup` prints one command: run it.

**3. Put it online** with [Tailscale](https://tailscale.com/download) (free)

```bash
sudo tailscale up
sudo tailscale funnel --bg 3000
```

The first time, it gives you a link to turn on Funnel. It then prints your address.

**4. Use that address**: in `.env.local`, set `APP_URL=https://your-address.ts.net`, then:

```bash
pm2 restart buildinio
```

| To | Run |
| --- | --- |
| Stop | `pm2 stop buildinio` |
| Start again | `pm2 start buildinio` |
| See logs | `pm2 logs buildinio` |
| Update | `git pull && npm install && npm run build && pm2 restart buildinio` |
| Take it offline | `sudo tailscale funnel reset` |

Your data is in `data/`. Back up that folder.
