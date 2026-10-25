import { Header } from "@/components/Header";
import { PromptBox } from "@/components/PromptBox";

export default function Home() {
  return (
    <>
      <div
        aria-hidden
        className="bg-dots pointer-events-none fixed inset-0 -z-10"
      />
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center overflow-x-clip px-4 pt-10 pb-28 text-center sm:px-6">
        <h1 className="max-w-3xl text-4xl leading-tight font-semibold tracking-[-0.02em] text-balance motion-safe:animate-rise sm:text-5xl lg:text-[3.5rem]">
          Build an app by describing it
        </h1>
        <p className="mt-4 max-w-xl text-base text-balance text-muted motion-safe:animate-rise motion-safe:[animation-delay:80ms] sm:text-lg">
          Type what you need, like you&rsquo;d tell a friend.
        </p>
        <PromptBox className="mt-10 motion-safe:animate-rise motion-safe:[animation-delay:160ms]" />
      </main>
    </>
  );
}
