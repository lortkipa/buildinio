<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/logo-dark.svg">
    <img src="brand/logo.svg" alt="buildinio" height="64">
  </picture>
</p>

<p align="center">An app builder for people who don't write code.</p>

## Quick start

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Email sign-in codes show up in the terminal.

## Settings

Copy `.env.example` to `.env.local`, fill in what you need, and restart. Everything is optional.

| What | Settings | Where to get it |
| --- | --- | --- |
| The AI (builds the apps) | `OPENAI_API_KEY`, `OPENAI_MODEL` | [OpenAI API keys](https://platform.openai.com/api-keys) |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | [Google Cloud](https://console.cloud.google.com/apis/credentials): OAuth client ID, "Web application" |
| GitHub sign-in | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | [GitHub](https://github.com/settings/developers): New OAuth App |
| Emailed codes | `RESEND_API_KEY`, `EMAIL_FROM` | [Resend](https://resend.com/api-keys) (verify your domain to email anyone but yourself) |

For Google and GitHub, the callback address is `<your address>/api/auth/google/callback` (or `/github/`), like `http://localhost:3000/api/auth/google/callback`.

The AI runs `npm` inside [Docker](https://docs.docker.com/get-docker/), so keep Docker running. No Docker? Set `SANDBOX=host` to run it on your computer instead (easier, but not isolated).

## Host it at home

Run Buildinio on a laptop, a NAS or any always-on computer, and open it from anywhere over HTTPS. No router setup needed.

> [!WARNING]
> Anyone with the address can sign up and use your OpenAI credits. Set a [spending limit](https://platform.openai.com/settings/organization/limits) on your OpenAI account.

### 1. Start the app

```bash
npm install
npm run build
npm install -g pm2
pm2 start npm --name buildinio -- start
pm2 save
pm2 startup
```

`pm2` keeps the app running and starts it again after a reboot (run the command `pm2 startup` prints). The app is now at http://localhost:3000.

### 2. Give it an address

Pick one:

**A. Your own domain (paid), with Cloudflare Tunnel**

1. Add your domain to [Cloudflare](https://dash.cloudflare.com) (free plan).
2. Go to **Zero Trust → Networks → Tunnels → Create a tunnel**, choose **Cloudflared**, and run the install command it shows on your computer.
3. Add a **public hostname**, like `app.yourdomain.com`, pointing to `http://localhost:3000`.

**B. A free address, with Tailscale Funnel**

1. Install [Tailscale](https://tailscale.com/download) and sign in.
2. Run:

   ```bash
   sudo tailscale funnel --bg 3000
   ```

   The first time, it gives you a link to turn on Funnel. Then it prints your address, like `https://my-laptop.tail1234.ts.net`. It stays the same and keeps working after reboots.

### 3. Tell the app its address

In `.env.local`, set your new address:

```bash
APP_URL=https://app.yourdomain.com
```

Then restart with `pm2 restart buildinio`. If you use Google or GitHub sign-in, add the new callback addresses there too (see [Settings](#settings)).

### Updating and backups

```bash
git pull && npm install && npm run build && pm2 restart buildinio
```

All your data (accounts and projects) is in the `data/` folder. Copy it somewhere safe now and then.
