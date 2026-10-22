// The main part of /login and /signup, for each step of signing in: a heading, the text under it,
// and the step's content.
export function AuthPanel({
  heading,
  description,
  children,
}: {
  heading: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 pt-8 pb-[12vh]">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* One line from sm up, even when wider than the column (it stays centered). */}
          <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl sm:whitespace-nowrap">
            {/* A span, so the gradient spans the text rather than the full column width. */}
            <span className="text-brand-gradient">{heading}</span>
          </h1>
          <p className="text-base text-pretty text-zinc-600 dark:text-zinc-300">{description}</p>
        </div>

        {children}
      </div>
    </main>
  );
}
