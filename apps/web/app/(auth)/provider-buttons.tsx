"use client";

import { useEffect, useState } from "react";
import { authClient, isUnreachable, settle, UNREACHABLE } from "../auth-client";
import { LoaderIcon } from "../icons";

type Provider = "google" | "github";

const PROVIDER_NAMES: Record<Provider, string> = { google: "Google", github: "GitHub" };

// The .env keys the API needs for each provider.
const PROVIDER_KEYS: Record<Provider, string> = {
  google: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
  github: "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET",
};

// Why starting to sign in failed, for the toast.
function signInErrorMessage(provider: Provider, error: { status: number; code?: string }) {
  const name = PROVIDER_NAMES[provider];
  // The API has no keys for this provider.
  if (error.code === "PROVIDER_NOT_FOUND") {
    if (process.env.NODE_ENV === "development") {
      return `${name} sign-in isn’t set up. Add ${PROVIDER_KEYS[provider]} to .env and restart the API.`;
    }
    return `${name} sign-in isn’t available yet.`;
  }
  if (isUnreachable(error)) return UNREACHABLE;
  return `Couldn’t sign in with ${name}. Try again.`;
}

// After a failed round trip to Google or GitHub, Better Auth comes back to the sign-in page with
// ?error=<code>.
export function callbackErrorMessage(code: string) {
  if (code === "access_denied") return "Sign-in was cancelled.";
  // Only from GitHub: the API refuses an email GitHub hasn't verified (apps/api/src/auth.ts).
  if (code === "email_not_found") {
    return "Couldn’t get a verified email from GitHub. Verify your email on GitHub, then try again.";
  }
  return "Couldn’t sign you in. Try again.";
}

// Continue with Google and GitHub. Each leaves for the provider and comes back signed in: to the
// name step for a new account, else to the home page.
export function ProviderButtons({ onError }: { onError: (message: string) => void }) {
  const [busy, setBusy] = useState<Provider | null>(null);

  // Back from the provider's page can restore this page as it was left, still "Connecting…".
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setBusy(null);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  async function signIn(provider: Provider) {
    if (busy) return;
    setBusy(provider);
    const { error } = await settle(
      authClient.signIn.social({
        provider,
        callbackURL: "/",
        newUserCallbackURL: "/welcome",
        // Back to this page (/login or /signup), with ?error=.
        errorCallbackURL: window.location.pathname,
      }),
    );
    // On success the browser is on its way to the provider, so "Connecting…" stays.
    if (!error) return;
    setBusy(null);
    onError(signInErrorMessage(provider, error));
  }

  return (
    <>
      <ProviderButton
        icon={<GoogleIcon className="size-5" />}
        busy={busy === "google"}
        disabled={busy !== null}
        onClick={() => signIn("google")}
      >
        Continue with Google
      </ProviderButton>
      <ProviderButton
        icon={<GitHubIcon className="size-5" />}
        busy={busy === "github"}
        disabled={busy !== null}
        onClick={() => signIn("github")}
      >
        Continue with GitHub
      </ProviderButton>

      <div className="flex items-center gap-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
        <span aria-hidden className="h-px flex-1 bg-zinc-950/10 dark:bg-white/10" />
        or
        <span aria-hidden className="h-px flex-1 bg-zinc-950/10 dark:bg-white/10" />
      </div>
    </>
  );
}

function ProviderButton({
  icon,
  busy,
  disabled,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // aria-disabled rather than disabled, so the clicked button keeps the focus.
      aria-disabled={disabled}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-zinc-950/10 bg-white/80 px-5 text-base font-medium shadow-sm backdrop-blur-xl transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet aria-disabled:cursor-default aria-disabled:hover:bg-white/80 dark:border-white/10 dark:bg-zinc-900/75 dark:hover:bg-zinc-800 dark:aria-disabled:hover:bg-zinc-900/75"
    >
      {busy ? (
        <>
          <LoaderIcon className="size-5" />
          Connecting…
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}

// Google's and GitHub's own marks, unchanged, as their brand guidelines ask.
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className={className}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}
