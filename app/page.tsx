import { Suspense } from "react";
import { cookies } from "next/headers";
import { AppShell } from "@/components/AppShell";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { getCurrentUser } from "@/lib/auth/session";
import { parseSidebar, SIDEBAR_COLLAPSED_COOKIE, SIDEBAR_WIDTH_COOKIE } from "@/lib/sidebar";

const main =
  "flex flex-1 flex-col items-center justify-center overflow-x-clip px-4 pt-10 pb-28 text-center sm:px-6";

export default function Home() {
  return (
    <>
      <div
        aria-hidden
        className="bg-dots pointer-events-none fixed inset-0 -z-10"
      />
      {/* Reads the session, so it streams in. */}
      <Suspense>
        <HomeContent />
      </Suspense>
    </>
  );
}

/** The app with the sidebar when signed in, otherwise the landing page. */
async function HomeContent() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <Header />
        <main className={main}>
          <Hero
            title="Build an app by describing it"
            subtitle={<>Type what you need, like you&rsquo;d tell a friend.</>}
          />
        </main>
      </>
    );
  }

  const store = await cookies();
  const sidebar = parseSidebar(
    store.get(SIDEBAR_WIDTH_COOKIE)?.value,
    store.get(SIDEBAR_COLLAPSED_COOKIE)?.value,
  );
  const firstName = user.name.split(" ")[0];
  // Keyed by user, so nothing carries over from someone else.
  return (
    <AppShell key={user.id} user={user} sidebar={sidebar}>
      <main className={main}>
        <Hero title={`What should we build, ${firstName}?`} signedIn />
      </main>
    </AppShell>
  );
}
