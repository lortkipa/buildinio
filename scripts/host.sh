#!/usr/bin/env bash
# Hosts Buildinio on this Linux computer (a laptop, mini PC, Raspberry Pi or NAS), so it
# keeps running in the background, starts again after a reboot, and is reachable on the
# internet at an https:// address. See docs/hosting.md.
#
#   scripts/host.sh            install everything and pick an address (run it again to change answers)
#   scripts/host.sh address    pick a different address
#   scripts/host.sh update     get the newest Buildinio and restart
#   scripts/host.sh status     is it running, and where
#   scripts/host.sh logs       what it's doing (sign-in codes show here too); Ctrl+C to stop watching
#   scripts/host.sh restart | stop | start
#   scripts/host.sh backup     save your accounts, projects and settings in one file
#   scripts/host.sh uninstall  stop it and remove it from startup (keeps your data)

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE=buildinio
TUNNEL_SERVICE=buildinio-tunnel
STATE="$APP_DIR/data/hosting" # Which address method is set up, to undo it when switching.
PORT="${PORT:-3000}"
MIN_NODE=22
RUN_USER="$(id -un)"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
info() { printf '%s\n' "$*"; }
warn() { printf '\n\033[33m%s\033[0m\n' "$*" >&2; }
die() { printf '\n\033[31m%s\033[0m\n\n' "$*" >&2; exit 1; }

as_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo "$@"; fi
}

ask() { # ask "Question" default → the answer, or the default on Enter
  local answer
  read -r -p "$1${2:+ [$2]}: " answer </dev/tty
  printf '%s' "${answer:-$2}"
}

env_get() { node "$APP_DIR/scripts/setup.mjs" get "$1"; }
env_set() { node "$APP_DIR/scripts/setup.mjs" set "$@"; }

# ── The computer ────────────────────────────────────────────────────────────────

check_system() {
  [ -z "${SUDO_USER:-}" ] || die "Run it without sudo: it asks for your password when it needs it."
  [ "$(uname -s)" = Linux ] || die "This script is for Linux. On a Mac or Windows PC, see \"Try it on your computer\" in the README."
  [ -d /run/systemd/system ] || die "This Linux doesn't use systemd, which this script needs to keep Buildinio running. See docs/hosting.md for other options."
  case "$(uname -m)" in
    x86_64 | aarch64 | arm64) ;;
    *) die "Buildinio needs a 64-bit computer (x86_64 or arm64), and this one is $(uname -m). On a Raspberry Pi, install the 64-bit Raspberry Pi OS." ;;
  esac
  if [ "$(id -u)" -ne 0 ] && ! sudo -v; then
    die "This needs your password for sudo, to install programs and set up the background service."
  fi
}

pkg_install() {
  if command -v apt-get >/dev/null; then
    as_root apt-get update -qq && as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$@"
  elif command -v dnf >/dev/null; then
    as_root dnf install -y -q "$@"
  elif command -v pacman >/dev/null; then
    as_root pacman -S --needed --noconfirm "$@"
  else
    die "Couldn't install $* by itself on this Linux. Install it, then run this again."
  fi
}

ensure_basics() {
  local missing=()
  for tool in curl git; do command -v "$tool" >/dev/null || missing+=("$tool"); done
  [ "${#missing[@]}" -eq 0 ] || pkg_install "${missing[@]}"
}

node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }

ensure_node() {
  [ "$(node_major)" -ge "$MIN_NODE" ] && return
  say "Installing Node.js $MIN_NODE…"
  if command -v apt-get >/dev/null; then
    curl -fsSL "https://deb.nodesource.com/setup_$MIN_NODE.x" | as_root bash -
    pkg_install nodejs
  elif command -v dnf >/dev/null; then
    curl -fsSL "https://rpm.nodesource.com/setup_$MIN_NODE.x" | as_root bash -
    pkg_install nodejs
  elif command -v pacman >/dev/null; then
    pkg_install nodejs npm
  fi
  hash -r
  [ "$(node_major)" -ge "$MIN_NODE" ] || die "Couldn't install Node.js $MIN_NODE or newer. Get it from https://nodejs.org/en/download, then run this again."
}

ensure_docker() {
  if ! command -v docker >/dev/null; then
    say "Installing Docker, where the AI's commands run…"
    if command -v pacman >/dev/null; then pkg_install docker; else curl -fsSL https://get.docker.com | as_root sh; fi
  fi
  as_root systemctl enable --now docker >/dev/null
  if [ "$(id -u)" -ne 0 ] && [[ " $(id -nG "$RUN_USER") " != *" docker "* ]]; then
    as_root usermod -aG docker "$RUN_USER" # Lets Buildinio's service use Docker without sudo.
  fi
}

# Downloads the image the AI's commands run in now, so the first app doesn't wait for it.
pull_sandbox_image() {
  local version image
  version="$(node -p "require('$APP_DIR/node_modules/playwright-core/package.json').version")"
  image="$(env_get SANDBOX_IMAGE)"
  say "Downloading the sandbox for the AI's commands (about 2 GB, once)…"
  as_root docker pull "mcr.microsoft.com/playwright:v$version-noble"
  [ -z "$image" ] || as_root docker pull "$image"
}

# Keeps a laptop running with its lid closed, and stops any computer from going to sleep.
offer_no_sleep() {
  [ "$(systemctl is-enabled sleep.target 2>/dev/null || true)" != masked ] || return 0
  local laptop=""
  compgen -G "/sys/class/power_supply/BAT*" >/dev/null && laptop=" (and keep running with the lid closed)"
  say "A server has to stay awake to be reachable."
  if [ "$(ask "Stop this computer from going to sleep$laptop? y/n" y)" = y ]; then
    as_root systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target >/dev/null
    if [ -n "$laptop" ]; then
      as_root mkdir -p /etc/systemd/logind.conf.d
      printf '[Login]\nHandleLidSwitch=ignore\nHandleLidSwitchExternalPower=ignore\nHandleLidSwitchDocked=ignore\n' |
        as_root tee /etc/systemd/logind.conf.d/buildinio.conf >/dev/null
      info "Done. Closing the lid will only turn the screen off after the next restart."
    fi
  fi
}

# ── Buildinio ───────────────────────────────────────────────────────────────────

build_app() {
  say "Installing Buildinio's parts and building it (a few minutes)…"
  cd "$APP_DIR"
  npm ci --no-audit --no-fund
  npm run build
}

write_service() {
  local node path
  node="$(command -v node)"
  # The AI's commands need npm (next to node) and docker on the path.
  path="$(dirname "$node"):/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  # Only reachable from this computer: people come in through the https address.
  as_root tee "/etc/systemd/system/$SERVICE.service" >/dev/null <<EOF
[Unit]
Description=Buildinio
After=network-online.target docker.service
Wants=network-online.target

[Service]
User=$RUN_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment="PATH=$path"
ExecStart="$node" "$APP_DIR/node_modules/next/dist/bin/next" start -H 127.0.0.1 -p $PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  as_root systemctl daemon-reload
  as_root systemctl enable "$SERVICE" >/dev/null
  as_root systemctl restart "$SERVICE"
}

wait_until_up() {
  for _ in $(seq 1 30); do
    curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && return 0
    sleep 1
  done
  warn "Buildinio didn't start. See why with: scripts/host.sh logs"
  return 1
}

# ── The address ─────────────────────────────────────────────────────────────────

choose_address() {
  say "How should people reach Buildinio?"
  info "  1. A free address, like https://my-laptop.tail1a2b3c.ts.net (Tailscale). Nothing to buy."
  info "  2. Your own domain, through Cloudflare. Free, with no router changes; the domain must be on Cloudflare."
  info "  3. Your own domain, with your router forwarding ports 80 and 443 here (Caddy). For people who know their router."
  local choice url
  choice="$(ask "1, 2 or 3" 1)"
  case "$choice" in
    1) url="$(setup_tailscale)" ;;
    2) url="$(setup_cloudflare)" ;;
    3) url="$(setup_caddy)" ;;
    *) die "Pick 1, 2 or 3." ;;
  esac
  env_set "APP_URL=$url"
  as_root systemctl restart "$SERVICE"
  wait_until_up || true
  summary "$url"
}

# Undoes the address method set up before, when switching to another.
forget_address() {
  local previous
  previous="$(cat "$STATE" 2>/dev/null || true)"
  [ "$previous" != "$1" ] || return 0
  case "$previous" in
    tailscale) as_root tailscale serve reset >/dev/null 2>&1 || true ;;
    cloudflare) as_root systemctl disable --now "$TUNNEL_SERVICE" >/dev/null 2>&1 || true ;;
    caddy) as_root systemctl disable --now caddy >/dev/null 2>&1 || true ;;
  esac
  mkdir -p "$(dirname "$STATE")"
  printf '%s\n' "$1" >"$STATE"
}

ask_domain() {
  local domain
  domain="$(ask "Your domain, or a part of it, like example.com or apps.example.com" "")"
  domain="$(printf '%s' "$domain" | tr '[:upper:]' '[:lower:]' | sed -E 's#^https?://##; s#/.*$##')"
  [[ "$domain" =~ ^([a-z0-9-]+\.)+[a-z]{2,}$ ]] || die "\"$domain\" isn't a domain, like example.com."
  printf '%s' "$domain"
}

# These print what they do on stderr, and only the address on stdout.

setup_tailscale() {
  {
    say "Tailscale gives this computer a free https address."
    info "  1. Public: anyone with the link can open it, like your shared apps."
    info "  2. Private: only your own devices, signed in to Tailscale, can open it."
  } >&2
  local mode name
  mode="$(ask "1 or 2" 1)"
  if ! command -v tailscale >/dev/null; then
    say "Installing Tailscale…" >&2
    curl -fsSL https://tailscale.com/install.sh | as_root sh >&2
  fi
  as_root systemctl enable --now tailscaled >/dev/null 2>&1
  if ! as_root tailscale status >/dev/null 2>&1; then
    say "Log in to Tailscale (a free account) with the link below." >&2
    as_root tailscale up >&2
  fi
  forget_address tailscale
  as_root tailscale serve reset >/dev/null 2>&1 || true
  if [ "$mode" = 2 ]; then
    as_root tailscale serve --bg "$PORT" >&2
  else
    say "If a link shows below, open it to allow public addresses (Funnel) for your Tailscale account." >&2
    as_root tailscale funnel --bg "$PORT" >&2
  fi
  name="$(as_root tailscale status --json | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>console.log(JSON.parse(s).Self.DNSName.replace(/\.$/,"")))')"
  [ -n "$name" ] || die "Couldn't find this computer's Tailscale address."
  printf 'https://%s' "$name"
}

ensure_cloudflared() {
  command -v cloudflared >/dev/null && return
  local arch
  case "$(uname -m)" in x86_64) arch=amd64 ;; *) arch=arm64 ;; esac
  say "Installing cloudflared…" >&2
  curl -fsSL -o "/tmp/cloudflared.$$" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$arch"
  as_root install -m 755 "/tmp/cloudflared.$$" /usr/local/bin/cloudflared
  rm -f "/tmp/cloudflared.$$"
}

tunnel_id() {
  cloudflared tunnel list --name buildinio --output json 2>/dev/null |
    node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{try{console.log(JSON.parse(s)[0]?.id??"")}catch{console.log("")}})'
}

setup_cloudflare() {
  {
    say "Cloudflare connects your domain to this computer through a tunnel."
    info "First, your domain must be added to a free Cloudflare account, using Cloudflare's nameservers (see docs/hosting.md)."
  } >&2
  local domain id creds
  domain="$(ask_domain)"
  ensure_cloudflared
  if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
    say "Open the link below, log in to Cloudflare and pick your domain." >&2
    cloudflared tunnel login >&2
  fi
  id="$(tunnel_id)"
  if [ -z "$id" ]; then
    cloudflared tunnel create buildinio >&2
    id="$(tunnel_id)"
  fi
  creds="$HOME/.cloudflared/$id.json"
  [ -f "$creds" ] || die "A tunnel named \"buildinio\" is already in your Cloudflare account, made on another computer. Delete it in Cloudflare (Zero Trust → Networks → Tunnels), then run this again."
  cloudflared tunnel route dns --overwrite-dns buildinio "$domain" >&2

  forget_address cloudflare
  as_root mkdir -p /etc/cloudflared
  as_root install -m 600 "$creds" /etc/cloudflared/buildinio.json
  as_root tee /etc/cloudflared/buildinio.yml >/dev/null <<EOF
tunnel: $id
credentials-file: /etc/cloudflared/buildinio.json
ingress:
  - hostname: $domain
    service: http://127.0.0.1:$PORT
  - service: http_status:404
EOF
  as_root tee "/etc/systemd/system/$TUNNEL_SERVICE.service" >/dev/null <<EOF
[Unit]
Description=Cloudflare Tunnel for Buildinio
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/cloudflared --no-autoupdate --config /etc/cloudflared/buildinio.yml tunnel run
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  as_root systemctl daemon-reload
  as_root systemctl enable "$TUNNEL_SERVICE" >/dev/null 2>&1
  as_root systemctl restart "$TUNNEL_SERVICE"
  printf 'https://%s' "$domain"
}

setup_caddy() {
  local domain ip lan
  domain="$(ask_domain)"
  if ! command -v caddy >/dev/null; then
    say "Installing Caddy…" >&2
    pkg_install caddy >&2 || die "Couldn't install Caddy. Install it (https://caddyserver.com/docs/install), then run this again."
  fi
  forget_address caddy
  if [ -f /etc/caddy/Caddyfile ] && ! grep -q "scripts/host.sh" /etc/caddy/Caddyfile; then
    as_root cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.before-buildinio"
  fi
  as_root tee /etc/caddy/Caddyfile >/dev/null <<EOF
# Written by Buildinio's scripts/host.sh. Caddy gets the https certificate by itself.
$domain {
	reverse_proxy 127.0.0.1:$PORT {
		flush_interval -1
	}
}
EOF
  as_root systemctl enable caddy >/dev/null 2>&1
  as_root systemctl restart caddy
  ip="$(curl -fsS --max-time 5 https://api.ipify.org || echo "your public IP")"
  lan="$(hostname -I 2>/dev/null | awk '{print $1}')"
  {
    say "Two things to do yourself, if you haven't yet:"
    info "  1. Where you bought the domain, add a DNS record: type A, name $domain, value $ip."
    info "  2. On your router, forward ports 80 and 443 (TCP) to this computer, ${lan:-its local IP}."
    info "Caddy gets the https certificate by itself once both work (a few minutes after)."
  } >&2
  printf 'https://%s' "$domain"
}

summary() {
  local url="$1"
  say "Buildinio is running at $url"
  info "Open it and sign up: the first account is yours."
  [ -n "$(env_get RESEND_API_KEY)" ] || info "Email sign-in codes aren't emailed yet: see them with  scripts/host.sh logs"
  [ -n "$(env_get OPENAI_API_KEY)" ] || info "The AI is off until you add your OpenAI key: run  scripts/host.sh  again."
  info ""
  info "For Google or GitHub sign-in (optional, see the README), use these callback addresses:"
  info "  $url/api/auth/google/callback"
  info "  $url/api/auth/github/callback"
  info ""
  info "It starts by itself when this computer does. Useful commands:"
  info "  scripts/host.sh status    scripts/host.sh logs    scripts/host.sh update    scripts/host.sh backup"
}

# ── Commands ────────────────────────────────────────────────────────────────────

install() {
  check_system
  ensure_basics
  ensure_node
  node "$APP_DIR/scripts/setup.mjs" --hosting
  [ "$(env_get SANDBOX)" = host ] || ensure_docker
  as_root systemctl stop "$SERVICE" 2>/dev/null || true # Run again: the build replaces what it runs on.
  build_app
  [ "$(env_get SANDBOX)" = host ] || pull_sandbox_image
  write_service
  wait_until_up || true
  offer_no_sleep
  choose_address
}

update() {
  cd "$APP_DIR"
  say "Getting the newest Buildinio…"
  git pull --ff-only || die "Couldn't update: files here were changed. See \"Updating\" in docs/hosting.md."
  exec "$APP_DIR/scripts/host.sh" rebuild # The new version of this script does the rest.
}

rebuild() {
  as_root systemctl stop "$SERVICE"
  build_app
  write_service
  wait_until_up && say "Updated, and running at $(env_get APP_URL)"
}

status() {
  systemctl --no-pager status "$SERVICE" | head -5 || true
  info ""
  info "Address: $(env_get APP_URL)"
  [ ! -f "$STATE" ] || info "Through: $(cat "$STATE")"
}

backup() {
  local file
  file="$HOME/buildinio-backup-$(date +%Y-%m-%d-%H%M).tar.gz"
  say "Saving to $file…"
  # Stopped for a moment, so the database is saved whole. Downloaded packages and builds are left out.
  as_root systemctl stop "$SERVICE"
  if ! tar -czf "$file" -C "$APP_DIR" --exclude='node_modules' --exclude='npm-cache' --exclude='.snapshots' --exclude='playwright*' data .env.local; then
    as_root systemctl start "$SERVICE"
    die "Couldn't save the backup."
  fi
  as_root systemctl start "$SERVICE"
  info "Done. To restore it: stop Buildinio, unpack it in $APP_DIR (tar -xzf <file> -C $APP_DIR), then start it."
}

uninstall() {
  as_root systemctl disable --now "$SERVICE" "$TUNNEL_SERVICE" >/dev/null 2>&1 || true
  as_root rm -f "/etc/systemd/system/$SERVICE.service" "/etc/systemd/system/$TUNNEL_SERVICE.service"
  as_root systemctl daemon-reload
  if [ "$(cat "$STATE" 2>/dev/null)" = tailscale ]; then as_root tailscale serve reset || true; fi
  if [ "$(cat "$STATE" 2>/dev/null)" = caddy ]; then as_root systemctl disable --now caddy || true; fi
  rm -f "$STATE"
  say "Buildinio is stopped and won't start with the computer anymore."
  info "Your data is still in $APP_DIR/data. Delete the folder to remove everything."
}

main() {
  case "${1:-install}" in
    install) install ;;
    address) check_system && choose_address ;;
    update) update ;;
    rebuild) rebuild ;;
    status) status ;;
    logs) journalctl -u "$SERVICE" -f -n 100 ;;
    restart | stop | start) as_root systemctl "$1" "$SERVICE" ;;
    backup) backup ;;
    uninstall) uninstall ;;
    *) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
  esac
}

# On one line, so `update` changing this file while it runs can't change what runs next.
main "$@"; exit
