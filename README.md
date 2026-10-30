<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/logo-dark.svg">
    <img src="brand/logo.svg" alt="buildinio" height="64">
  </picture>
</p>

<p align="center">An app builder for people who don't write code.</p>

## Run locally

Requires Node.js 22 or newer, and [Docker](https://docs.docker.com/get-docker/) running for the AI to build apps.

```bash
npm install
npm run dev
```

Open http://localhost:3000. On a phone on the same Wi-Fi, open `http://<your-computer's-IP>:3000`.

Data lives in `data/`: the SQLite database (`buildinio.db`, created on first start) and each project's code (`projects/`).

## Configuration

Copy `.env.example` to `.env.local`, fill in what you need, and restart the server. Everything is optional.

### Sign-in

Without keys, email codes are printed in the terminal and the Google and GitHub buttons say they aren't set up.

- **Google**: in [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth client ID ("Web application") with the redirect URI `http://localhost:3000/api/auth/google/callback`. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- **GitHub**: in [GitHub Developer settings](https://github.com/settings/developers), create an OAuth App with the callback URL `http://localhost:3000/api/auth/github/callback`. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
- **Email**: create a [Resend](https://resend.com/api-keys) API key and set `RESEND_API_KEY`. To email anyone besides yourself, verify your domain in Resend and set `EMAIL_FROM` (like `buildinio <hello@yourdomain.com>`).

### AI

The AI is an OpenAI model. Without a key, every answer says how to set it up.

- `OPENAI_API_KEY`: from [OpenAI's API keys page](https://platform.openai.com/api-keys).
- `OPENAI_MODEL`: any model that supports the Responses API and function calling, like `gpt-6-luna`.
- `OPENAI_REASONING_EFFORT` (optional): like `low`, `medium` or `high`.
- `OPENAI_SMALL_MODEL` and `OPENAI_SMALL_REASONING_EFFORT` (optional): a cheaper model for side jobs like naming projects.

Each answer logs its token use in the server console.

### Sandbox

The AI's commands (npm, builds, screenshots) run in a throwaway Docker container that only sees the project's folder. The image is Playwright's, a large download that starts in the background when the server starts. It needs to reach npm and `ui.shadcn.com`.

To skip Docker, set `SANDBOX=host`: commands run directly on your computer, with your access. Fine for trying it out, not for a server others use.

## Production on a home server

These steps run buildinio on a Linux machine at home (a mini PC, an old laptop, a Raspberry Pi 5) at your own domain, like `https://buildinio.example.com`. Aim for 4 GB of RAM or more: each sandbox container can use up to 2 GB.

### 1. Install and build

Install Node.js 22+, Git and Docker, and let your user run Docker:

```bash
sudo usermod -aG docker $USER
```

Log out and back in, then:

```bash
git clone https://github.com/lortkipa/buildinio.git
```

```bash
cd buildinio && npm ci && npm run build
```

Create `.env.local` from `.env.example` (see [Configuration](#configuration)), with your domain:

```bash
APP_URL=https://buildinio.example.com
```

Try it with `npm start -- -H 127.0.0.1`. It listens on port 3000, only on this machine; the web server in step 3 makes it public.

### 2. Keep it running

Create `/etc/systemd/system/buildinio.service`, replacing `you` and the paths (find npm with `which npm`):

```ini
[Unit]
Description=buildinio
After=network-online.target docker.service
Wants=network-online.target

[Service]
User=you
WorkingDirectory=/home/you/buildinio
ExecStart=/usr/bin/npm start -- -H 127.0.0.1 -p 3000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
```

```bash
sudo systemctl enable --now buildinio
```

Logs (including email codes and AI costs): `journalctl -u buildinio -f`.

### 3. Point your domain at it

You need HTTPS: in production, sign-in cookies only work over HTTPS. Pick one:

**Option A: Caddy with port forwarding** (recommended if your router allows it)

1. At your domain's DNS provider, add an `A` record for `buildinio.example.com` pointing to your home's public IP ([whatismyip.com](https://www.whatismyip.com)). If that IP changes, use your router's or DNS provider's dynamic DNS.
2. On your router, forward TCP ports 80 and 443 to the server's local IP. Give the server a fixed local IP (a DHCP reservation).
3. [Install Caddy](https://caddyserver.com/docs/install) and put this in `/etc/caddy/Caddyfile`:

   ```
   buildinio.example.com {
   	reverse_proxy 127.0.0.1:3000
   }
   ```

4. `sudo systemctl reload caddy`. Caddy gets and renews the HTTPS certificate on its own.

Pros: no third party in the middle, no upload limits. Cons: needs a router you control and a public IP (some internet providers use CGNAT, which blocks this).

**Option B: Cloudflare Tunnel** (no open ports)

Move your domain's DNS to Cloudflare, then follow [Cloudflare's tunnel guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) to install `cloudflared` and route `buildinio.example.com` to `http://127.0.0.1:3000`.

Pros: works behind CGNAT, hides your home IP. Cons: traffic goes through Cloudflare, and its free plan caps uploads at 100 MB per request (a prompt can carry up to ten 10 MB files).

If you use nginx instead, set `client_max_body_size 110m;` and `proxy_buffering off;` so attached files and streamed answers work.

### 4. Update the sign-in settings

Use your domain everywhere `localhost:3000` was:

- Google: add `https://buildinio.example.com/api/auth/google/callback` as a redirect URI.
- GitHub: set the callback URL to `https://buildinio.example.com/api/auth/github/callback` (or create a second OAuth App for production).
- Resend: verify your domain and set `EMAIL_FROM`.

Then `sudo systemctl restart buildinio`.

### Updating

```bash
git pull && npm ci && npm run build && sudo systemctl restart buildinio
```

Database migrations run on start. Answers in progress start again after the restart.

### Backups

Everything is in `data/` (or wherever `DATABASE_PATH` and `PROJECTS_PATH` point). Back it up with the server stopped:

```bash
sudo systemctl stop buildinio; tar czf buildinio-$(date +%F).tar.gz data; sudo systemctl start buildinio
```

### Before you share it

- Anyone who signs up uses your OpenAI key. Set a [spending limit](https://platform.openai.com/settings/organization/limits) on it.
- Keep `SANDBOX=docker`: the AI runs code it wrote. Containers can still reach your home network, so keep other devices on it secured.
- Keep the server's packages up to date (`sudo apt upgrade` on Debian/Ubuntu).

## More

- [`brand/`](brand/): logo files and usage rules.
- [`skills/`](skills/): the design guides the AI can read.
- [`AGENTS.md`](AGENTS.md): how the code is organized, for contributors and AI agents.
