import { PromptInput } from "./prompt-input";

export default function Home() {
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <div aria-hidden className="landing-bg" />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        {/* A plain link, not next/link: clicking the logo on this page reloads it. */}
        <a
          href="/"
          className="rounded-md transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-violet"
        >
          <picture>
            <source
              media="(prefers-color-scheme: dark)"
              srcSet="/brand/buildinio-logo-dark-bg.svg"
            />
            <img src="/brand/buildinio-logo-light-bg.svg" alt="Buildinio" width={140} height={27} />
          </picture>
        </a>

        {/* Placeholders until auth (Better Auth) is set up. Phones show only Sign up. */}
        <nav aria-label="Account" className="flex items-center gap-2">
          <button
            type="button"
            title="Coming soon"
            className="hidden h-9 rounded-full px-4 text-sm font-medium text-zinc-700 transition-colors sm:block hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            Log in
          </button>
          <button
            type="button"
            title="Coming soon"
            className="h-9 rounded-full bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Sign up
          </button>
        </nav>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pt-8 pb-[12vh]">
        {/* Headline, description and input share this column, so no text is wider than the input. */}
        <div className="flex w-full max-w-2xl flex-col items-center gap-10 text-center">
          <div className="flex flex-col items-center gap-5">
            <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-5xl">
              Describe it. <span className="text-brand-gradient">We’ll build it.</span>
            </h1>
            <p className="max-w-xl text-base text-pretty text-zinc-600 sm:text-lg dark:text-zinc-300">
              Turn your idea into a working app you can see and try right away.
            </p>
          </div>

          <PromptInput />
        </div>
      </main>
    </div>
  );
}
