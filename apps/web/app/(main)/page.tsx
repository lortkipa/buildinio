import { PromptInput } from "../prompt-input";
import { getSession } from "../session";
import { SiteHeader } from "../site-header";
import { NewProjectPrompt } from "./new-project-prompt";

// Signed out, the landing page. Signed in, the home page, where a new project starts (the layout
// adds the sidebar).
export default async function Home() {
  const session = await getSession();
  if (!session) return <Landing />;

  // Only the first name, to keep the headline short. The API trims names and never saves an empty one.
  const firstName = session.user.name.split(/\s+/)[0];

  return (
    <main className="flex flex-1 items-center justify-center px-4 pt-8 pb-[12vh]">
      <div className="flex w-full max-w-2xl flex-col items-center gap-10 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-balance wrap-break-word sm:text-4xl md:text-5xl">
          Let’s build, <span className="text-brand-gradient">{firstName}.</span>
        </h1>

        <NewProjectPrompt />
      </div>
    </main>
  );
}

function Landing() {
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <div aria-hidden className="glow-bg" />

      <SiteHeader logIn signUp />

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

          {/* Signing up comes first. */}
          <PromptInput nextStep="/signup" />
        </div>
      </main>
    </div>
  );
}
