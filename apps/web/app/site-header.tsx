import Link from "next/link";

// The landing page shows both account links; each auth page links only to the other one.
export function SiteHeader({
  logIn = false,
  signUp = false,
}: {
  logIn?: boolean;
  signUp?: boolean;
}) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
      {/* A plain link, not next/link: clicking the logo on the landing page reloads it. */}
      <a
        href="/"
        className="rounded-md transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-violet"
      >
        <picture>
          <source media="(prefers-color-scheme: dark)" srcSet="/brand/buildinio-logo-dark-bg.svg" />
          <img src="/brand/buildinio-logo-light-bg.svg" alt="Buildinio" width={140} height={27} />
        </picture>
      </a>

      <nav aria-label="Account" className="flex items-center gap-2">
        {logIn && (
          <Link
            href="/login"
            // Next to Sign up, phones show only Sign up.
            className={`${signUp ? "hidden sm:flex" : "flex"} h-9 items-center rounded-full px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white`}
          >
            Log in
          </Link>
        )}
        {signUp && (
          <Link
            href="/signup"
            className="flex h-9 items-center rounded-full bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Sign up
          </Link>
        )}
      </nav>
    </header>
  );
}
