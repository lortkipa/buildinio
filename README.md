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

The database is a SQLite file (`data/buildinio.db`), created on first start.

## Sign-in setup

Sign-up and log-in work without any setup: email codes are printed in the terminal, and the Google and GitHub buttons say they aren't set up yet. To turn them on, copy `.env.example` to `.env.local`, fill in the keys below and restart `npm run dev`.

- **Google**: in [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth client ID of type "Web application". Add `http://localhost:3000/api/auth/google/callback` as an authorized redirect URI. Put the ID and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- **GitHub**: in [GitHub Developer settings](https://github.com/settings/developers), create an OAuth App with the callback URL `http://localhost:3000/api/auth/github/callback`. Put the ID and secret in `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
- **Email**: create a [Resend](https://resend.com/api-keys) API key and put it in `RESEND_API_KEY`. To email anyone besides yourself, verify your domain in Resend and set `EMAIL_FROM` (like `buildinio <hello@yourdomain.com>`).

When deploying, set `APP_URL` to the public address and register the same callback paths on that address.

Brand assets and usage rules are in [`brand/`](brand/).
