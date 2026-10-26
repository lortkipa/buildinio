import "server-only";
import { decodeIdToken, GitHub, Google } from "arctic";
import type { Provider } from "@/lib/db/schema";

export const PROVIDERS: Record<Provider, { name: string; env: string }> = {
  google: { name: "Google", env: "GOOGLE" },
  github: { name: "GitHub", env: "GITHUB" },
};

export function isProvider(value: unknown): value is Provider {
  return value === "google" || value === "github";
}

/** What we learn about someone from Google or GitHub. */
export type ProviderProfile = {
  provider: Provider;
  providerAccountId: string;
  email: string;
  name: string;
  avatarUrl: string;
};

/** The provider has no verified email for this account, so we can't match it to one of ours. */
export class UnverifiedEmailError extends Error {}

function credentials(provider: Provider) {
  const { env } = PROVIDERS[provider];
  const id = process.env[`${env}_CLIENT_ID`];
  const secret = process.env[`${env}_CLIENT_SECRET`];
  return id && secret ? { id, secret } : null;
}

export function isConfigured(provider: Provider) {
  return credentials(provider) !== null;
}

function redirectURI(provider: Provider, origin: string) {
  return `${origin}/api/auth/${provider}/callback`;
}

function google(origin: string) {
  const { id, secret } = credentials("google")!;
  return new Google(id, secret, redirectURI("google", origin));
}

function github(origin: string) {
  const { id, secret } = credentials("github")!;
  return new GitHub(id, secret, redirectURI("github", origin));
}

/** The provider's sign-in page. Google also needs the PKCE code verifier. */
export function createAuthorizationURL(
  provider: Provider,
  origin: string,
  state: string,
  codeVerifier: string,
) {
  return provider === "google"
    ? google(origin).createAuthorizationURL(state, codeVerifier, ["openid", "profile", "email"])
    : github(origin).createAuthorizationURL(state, ["read:user", "user:email"]);
}

/** Trades the code from the callback for the person's profile. */
export async function fetchProfile(
  provider: Provider,
  origin: string,
  code: string,
  codeVerifier: string,
): Promise<ProviderProfile> {
  return provider === "google"
    ? fetchGoogleProfile(origin, code, codeVerifier)
    : fetchGitHubProfile(origin, code);
}

type GoogleClaims = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

async function fetchGoogleProfile(origin: string, code: string, codeVerifier: string) {
  const tokens = await google(origin).validateAuthorizationCode(code, codeVerifier);
  // The ID token comes straight from Google over HTTPS, so there's no need to check its signature.
  const claims = decodeIdToken(tokens.idToken()) as GoogleClaims;
  if (!claims.email || !claims.email_verified) throw new UnverifiedEmailError();
  return {
    provider: "google",
    providerAccountId: claims.sub,
    email: claims.email,
    name: claims.name ?? "",
    avatarUrl: claims.picture ?? "",
  } satisfies ProviderProfile;
}

type GitHubUser = { id: number; login: string; name: string | null; avatar_url: string };
type GitHubEmail = { email: string; primary: boolean; verified: boolean };

async function fetchGitHubProfile(origin: string, code: string) {
  const tokens = await github(origin).validateAuthorizationCode(code);
  const api = async <T>(path: string): Promise<T> => {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken()}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "buildinio",
      },
    });
    if (!response.ok) throw new Error(`GitHub ${path} answered ${response.status}`);
    return response.json();
  };
  const [user, emails] = await Promise.all([
    api<GitHubUser>("/user"),
    api<GitHubEmail[]>("/user/emails"),
  ]);
  const primary = emails.find((email) => email.primary && email.verified);
  if (!primary) throw new UnverifiedEmailError();
  return {
    provider: "github",
    providerAccountId: String(user.id),
    email: primary.email,
    name: user.name || user.login,
    avatarUrl: user.avatar_url,
  } satisfies ProviderProfile;
}
