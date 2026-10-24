import { SiteHeader } from "./site-header";

// Link and button classes for a status page's actions (buttons.ts), which links need laid out.
export const STATUS_ACTION = "inline-flex items-center justify-center";

/*
 * A full-page message: the 404 page (not-found.tsx) and the error pages (error.tsx,
 * global-error.tsx). The logo on top, over the drifting glow of the sign-in pages, then a big
 * status code when there is one, the heading (in the brand gradient when there is no code), the
 * text under it, the page's actions, and a footnote.
 */
export function StatusPage({
  code,
  heading,
  description,
  footnote,
  children,
}: {
  code?: string;
  heading: string;
  description: string;
  footnote?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <div aria-hidden className="glow-bg" />
      <SiteHeader />

      <main className="flex flex-1 items-center justify-center px-4 pt-8 pb-[12vh]">
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center gap-3">
            {code && (
              <p
                aria-hidden
                className="font-display text-8xl leading-none font-bold tracking-tight sm:text-9xl"
              >
                {/* A span, so the gradient spans the digits rather than the full column width. */}
                <span className="text-brand-gradient">{code}</span>
              </p>
            )}
            <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              {code ? heading : <span className="text-brand-gradient">{heading}</span>}
            </h1>
            <p className="text-base text-pretty text-zinc-600 dark:text-zinc-300">{description}</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">{children}</div>

          {footnote && <p className="text-xs text-zinc-500 dark:text-zinc-400">{footnote}</p>}
        </div>
      </main>
    </div>
  );
}
