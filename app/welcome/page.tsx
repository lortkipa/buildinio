import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFlow } from "@/components/AuthFlow";
import { Header } from "@/components/Header";
import { getPendingSignup } from "@/lib/auth/signup";

export const metadata: Metadata = {
  title: "Welcome | buildinio",
};

// First Google or GitHub sign-in lands here to pick a name (see the OAuth callback).
export default function Welcome() {
  return (
    <>
      <div
        aria-hidden
        className="bg-dots pointer-events-none fixed inset-0 -z-10"
      />
      <Suspense fallback={<Header buttons={[]} />}>
        <NameStep />
      </Suspense>
    </>
  );
}

async function NameStep() {
  const pending = await getPendingSignup();
  if (!pending) redirect("/signup");
  return <AuthFlow mode="signup" initialFlow={{ step: "name", name: pending.name }} />;
}
