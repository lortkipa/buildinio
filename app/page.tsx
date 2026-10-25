import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";

export default function Home() {
  return (
    <>
      <div
        aria-hidden
        className="bg-dots pointer-events-none fixed inset-0 -z-10"
      />
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center overflow-x-clip px-4 pt-10 pb-28 text-center sm:px-6">
        <Hero />
      </main>
    </>
  );
}
