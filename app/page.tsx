import { Suspense } from "react";
import { Header } from "@/components/Header";
import { HeaderAccount, HeaderAccountFallback } from "@/components/HeaderAccount";
import { Hero } from "@/components/Hero";

export default function Home() {
  return (
    <>
      <div
        aria-hidden
        className="bg-dots pointer-events-none fixed inset-0 -z-10"
      />
      {/* Reads the session, so it streams in while the rest of the page shows right away. */}
      <Header>
        <Suspense fallback={<HeaderAccountFallback />}>
          <HeaderAccount />
        </Suspense>
      </Header>
      <main className="flex flex-1 flex-col items-center justify-center overflow-x-clip px-4 pt-10 pb-28 text-center sm:px-6">
        <Hero />
      </main>
    </>
  );
}
