import type { Metadata } from "next";
import { AuthFlow } from "@/components/AuthFlow";

export const metadata: Metadata = {
  title: "Log in | buildinio",
};

export default function LogIn() {
  return (
    <>
      <div
        aria-hidden
        className="bg-dots pointer-events-none fixed inset-0 -z-10"
      />
      <AuthFlow mode="login" />
    </>
  );
}
