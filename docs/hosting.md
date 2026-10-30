# Host Buildinio at home

Run Buildinio on a computer at home, like an old laptop, a mini PC, a Raspberry Pi or a NAS, so it's always on and you can open it from anywhere, at an `https://` address you can share.

One script does the work: it installs what's needed, keeps Buildinio running in the background, starts it again after a reboot or a crash, and gives it an address.

**Contents:** [What you need](#what-you-need) · [Pick an address](#pick-an-address) · [Install](#install) · [After installing](#after-installing) · [Everyday commands](#everyday-commands) · [Keep it safe](#keep-it-safe) · [Updating](#updating) · [Backups](#backups) · [Troubleshooting](#troubleshooting) · [How it works](#how-it-works)

## What you need

- **A computer that can stay on**, with:
  - **Linux.** Ubuntu, Debian, Fedora, Arch and Raspberry Pi OS all work. Installing it fresh? Pick [Ubuntu 24.04 LTS](https://ubuntu.com/download/desktop) ([how to install](https://ubuntu.com/tutorials/install-ubuntu-desktop)).
  - **64 bits.** On a Raspberry Pi (a 4 or 5), install the 64-bit Raspberry Pi OS.
  - **At least 4 GB of memory** (8 GB is better) and **20 GB of free space**.
  - A wired internet connection if you can. Wi-Fi works too.
- **An OpenAI API key**, with some credit on it: [platform.openai.com/api-keys](https://platform.openai.com/api-keys). The AI that builds the apps runs on it.
- **Optional: a domain** you bought, like `example.com`. Without one you get a free address.

**On a NAS:** if it runs a Debian-based Linux (like OpenMediaVault), follow this guide on it as is. Synology and QNAP have their own systems, where the script can't run: make an Ubuntu virtual machine on the NAS ([Synology Virtual Machine Manager](https://kb.synology.com/en-global/DSM/help/Virtualization/virtualization_desc), [QNAP Virtualization Station](https://www.qnap.com/en/software/virtualization-station)), and follow this guide inside it.

## Pick an address

The installer asks how people should reach Buildinio. You can change your mind later.

|                          | **1. Free address** (Tailscale)          | **2. Your domain, through Cloudflare** | **3. Your domain, through your router** |
| ------------------------ | ---------------------------------------- | -------------------------------------- | --------------------------------------- |
| Looks like               | `https://my-laptop.tail1a2b3c.ts.net`    | `https://apps.example.com`             | `https://apps.example.com`              |
| Costs                    | Free                                     | Free (plus the domain)                 | Free (plus the domain)                  |
| Router changes           | None                                     | None                                   | Forward two ports                       |
| Works on any internet    | Yes                                      | Yes                                    | Not with every provider (see below)     |
| Can be private           | Yes, just your own devices               | No                                     | No                                      |
| You'll need              | A free Tailscale account                 | A free Cloudflare account              | To know your router's settings          |

**Not sure? Pick 1.** It takes a couple of minutes and needs nothing else. Got a domain later? Run `scripts/host.sh address` to switch.

## Install

### 1. Open a terminal on the computer

On Ubuntu, press **Ctrl+Alt+T**. On a computer without a screen, connect to it from another one with `ssh your-name@the-computer's-IP`.

### 2. Download Buildinio

Copy each command, paste it in the terminal (**Ctrl+Shift+V**) and press Enter. The first one installs Git (on Fedora, `sudo dnf install -y git`; on Arch, `sudo pacman -S git`):

```bash
sudo apt install -y git
```

```bash
git clone https://github.com/lortkipa/buildinio.git
```

```bash
cd buildinio
```

### 3. If you picked "your domain, through Cloudflare": move the domain to Cloudflare first

Skip this for the other two.

1. Make a free account at [cloudflare.com](https://dash.cloudflare.com/sign-up).
2. Click **Add a domain**, type your domain, and pick the **Free** plan.
3. Cloudflare shows two nameservers. Where you bought the domain (GoDaddy, Namecheap, …), replace its nameservers with those two. Your registrar's help pages call this "changing nameservers".
4. Wait until Cloudflare emails you that the domain is active. It's usually minutes, sometimes a few hours.

### 4. Run the installer

```bash
scripts/host.sh
```

It asks a few questions; press Enter to take the answer in [brackets]. Your answers are saved in `.env.local` (see [After installing](#after-installing)); if that file already has your key and model, just press Enter to keep them.

1. **Your password**, so it can install programs. (Typing it shows nothing: that's normal.)
2. **Your OpenAI API key**, and **the model**.
3. **Where the AI's commands run.** Pick **1, Docker**: each app is built in a sealed box that can't touch anything else on the computer.
4. Then it works for a while (10–20 minutes the first time): it installs Node.js and Docker, builds Buildinio, and downloads the box the AI works in (about 2 GB).
5. **Whether to stop the computer from sleeping.** Say yes: asleep, it can't be reached. On a laptop this also keeps it running with the lid closed (after the next restart).
6. **The address** (see [Pick an address](#pick-an-address)), and then:

<details open>
<summary><b>1. Free address (Tailscale)</b></summary>

- Pick **Public** (anyone with the link can open it, and your apps' share links work for anyone) or **Private** (only your own devices can open it).
- A link shows: open it on any device and sign in to Tailscale (with Google, Microsoft, GitHub, …). The script carries on by itself once you have.
- Public, the first time: another link shows, to allow public addresses ("Funnel") for your account. Open it and click to turn it on.
- Private: on each phone or computer you'll use, install the [Tailscale app](https://tailscale.com/download) and sign in with the same account.

The address is your computer's name plus a name Tailscale picked for your account. To change either, rename the computer under **Machines** in the [Tailscale admin console](https://login.tailscale.com/admin/machines), or pick a new account name under **DNS** → **Tailnet name**. Then run `scripts/host.sh address` so Buildinio knows.

</details>

<details>
<summary><b>2. Your domain, through Cloudflare</b></summary>

- Type the address you want, like `example.com`, or a part of it, like `apps.example.com`.
- A link shows: open it, log in to Cloudflare, click your domain, and click **Authorize**.

That's it: the script connects the address to this computer through a "tunnel". Your router stays as it is.

</details>

<details>
<summary><b>3. Your domain, through your router</b></summary>

- Type the address you want, like `example.com` or `apps.example.com`.
- The script sets up [Caddy](https://caddyserver.com), which gets the https certificate by itself, then tells you two things to do:
  1. **Point the domain here.** Where you bought it, add a DNS record of type `A`, with the address as its name, and the public IP the script shows as its value.
  2. **Open your router to this computer.** In your router's settings, forward ports `80` and `443` (TCP) to the local IP the script shows. While you're there, give this computer a fixed local IP (often called "DHCP reservation"), so the forwarding keeps working.

Two catches. Some internet providers share one public IP between many homes ("CGNAT"), and then nothing from outside reaches your router: if the WAN IP in your router's settings isn't the public IP the script showed, that's you, and options 1 and 2 still work. And your public IP can change: if it does, update the DNS record, or use your registrar's "dynamic DNS" if it has one.

</details>

When it's done, it shows your address.

## After installing

1. **Open the address and sign up.** The first account is yours.
2. **Sign-in codes:** until email is set up, the codes Buildinio would email are written in its log instead. See them with `scripts/host.sh logs` (press **Ctrl+C** to stop watching).
3. **Optional: easier sign-in.** To sign in with Google or GitHub, or to have codes emailed, see [Sign-in](../README.md#sign-in-google-github-and-email) in the README. Use the callback addresses the installer showed, which start with your address. Emailing codes to other people needs a domain of your own.

Settings live in the `.env.local` file in the `buildinio` folder. To change one, run `scripts/host.sh` again (it keeps what you don't change), or edit the file with `nano .env.local` (save with **Ctrl+O**, Enter, quit with **Ctrl+X**) and then run `scripts/host.sh restart`.

## Everyday commands

Run these in the `buildinio` folder (`cd buildinio` first, in a new terminal):

| Command                     | What it does                                                         |
| --------------------------- | -------------------------------------------------------------------- |
| `scripts/host.sh status`    | Whether it's running, and its address                                |
| `scripts/host.sh logs`      | What it's doing right now, sign-in codes too (Ctrl+C to stop)        |
| `scripts/host.sh update`    | Gets the newest Buildinio and restarts                               |
| `scripts/host.sh backup`    | Saves accounts, projects and settings in one file                    |
| `scripts/host.sh restart`   | Restarts it (also `stop` and `start`)                                |
| `scripts/host.sh address`   | Picks a different address                                            |
| `scripts/host.sh`           | Goes through the setup again, to change your answers                 |
| `scripts/host.sh uninstall` | Stops it for good (your data stays)                                  |

## Keep it safe

- **Anyone who can open a public address can sign up, and the AI they use runs on your OpenAI key.** Set a monthly budget in [OpenAI's limits page](https://platform.openai.com/settings/organization/limits), and only share the address with people you trust. If it's just for you and your family, pick the private Tailscale address.
- **Keep the AI's commands in Docker** (the installer's choice 1). Without it, the code the AI writes runs with the same access as your user on the computer.
- **Update now and then** with `scripts/host.sh update`, and keep the computer itself updated (on Ubuntu, `sudo apt update && sudo apt upgrade`).
- **Make backups** (see below), and keep a copy on another device.

## Updating

```bash
scripts/host.sh update
```

It downloads the newest version, rebuilds and restarts: Buildinio is away for a minute or two, and an answer the AI was in the middle of starts again.

If it says files here were changed: you (or something) edited Buildinio's files. Set the changes aside with `git stash` and update again. Your settings and data aren't affected: they're not part of the download.

## Backups

```bash
scripts/host.sh backup
```

This saves every account, chat, project and your settings in one file in your home folder, like `buildinio-backup-2026-10-30-1200.tar.gz` (Buildinio stops for a moment while it does). Copy it somewhere else, like a USB drive or a cloud folder.

**To restore** on this or a new computer: install Buildinio as above, then, in the `buildinio` folder:

```bash
scripts/host.sh stop
```

```bash
tar -xzf ~/buildinio-backup-2026-10-30-1200.tar.gz
```

```bash
scripts/host.sh start
```

(Use your backup's name in the middle one.) On a new computer, run `scripts/host.sh address` afterwards, so the address points to it.

## Troubleshooting

- **The address doesn't open.** Run `scripts/host.sh status`. If it isn't running, `scripts/host.sh logs` says why. Is the computer on, awake and online?
- **Logging in doesn't stick, or sends you back to the log-in page.** Open the `https://` address. Log-ins only work over https, so `http://192.168.x.x:3000` won't do.
- **Google says `redirect_uri_mismatch`, or GitHub says the redirect URI isn't associated.** The callback address you gave them has to match exactly, `https://` and all. `scripts/host.sh` shows them at the end.
- **The AI says Docker isn't running.** Run `sudo systemctl start docker`, then try again.
- **The AI says it isn't set up.** Your OpenAI key or model is missing: run `scripts/host.sh` again.
- **The address works at home but not elsewhere (option 3).** Check the port forwarding and the DNS record, and that your provider doesn't use CGNAT (see option 3 above).
- **Moved to a new address**, like from Tailscale to your domain: change the callback addresses at Google and GitHub to the new one too.

## Uninstalling

```bash
scripts/host.sh uninstall
```

Buildinio stops and won't start with the computer anymore. Your data stays in the `buildinio` folder: delete the folder to remove everything. Tailscale, Cloudflare's `cloudflared`, Caddy and Docker stay installed, for you to remove if you want.

## How it works

For the curious, or to do it by hand:

- **Buildinio** is built with `npm ci && npm run build` and runs as a systemd service named `buildinio` (`/etc/systemd/system/buildinio.service`), as your user, with `next start -H 127.0.0.1 -p 3000`. It's only reachable from the computer itself: everyone else comes in through the address below. Set `PORT=…` before `scripts/host.sh` to use another port.
- **The address** carries https traffic to it:
  - Tailscale: `tailscale funnel --bg 3000` (public) or `tailscale serve --bg 3000` (private). Turn it off with `sudo tailscale serve reset`.
  - Cloudflare: a named tunnel, `buildinio`, run by the `buildinio-tunnel` service from `/etc/cloudflared/buildinio.yml`. Cloudflare takes uploads up to 100 MB at a time.
  - Caddy: `/etc/caddy/Caddyfile` (a copy of the one before is kept as `Caddyfile.before-buildinio`).
  - Whichever it is, `APP_URL` in `.env.local` is set to the address, which Google, GitHub and the emails' links use.
- **Docker:** the installer adds your user to the `docker` group, so the service can start the AI's sandboxes, and downloads Playwright's image they run in.
- **Sleep:** saying yes masks systemd's sleep targets and, on a laptop, sets the lid to do nothing (`/etc/systemd/logind.conf.d/buildinio.conf`).
- **Your data** is in `data/` (the database and each project's code) and your settings in `.env.local`. Neither is part of the Git download, so updates leave them be.
