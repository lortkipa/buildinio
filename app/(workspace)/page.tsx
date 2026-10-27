import { Suspense } from "react";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { getCurrentUser } from "@/lib/auth/session";

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

  const firstName = user.name.split(" ")[0];
  return (
    <main className={main}>
      <Hero title={`What should we build, ${firstName}?`} signedIn />
    </main>
  );
}
