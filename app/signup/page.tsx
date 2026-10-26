import type { Metadata } from "next";
import { AuthFlow } from "@/components/AuthFlow";

export const metadata: Metadata = {
  title: "Sign up | buildinio",
};

export default function SignUp() {
  return (
    <>
      <div
        aria-hidden
        className="bg-dots pointer-events-none fixed inset-0 -z-10"
      />
      <AuthFlow mode="signup" />
    </>
  );
}
