import type { Metadata } from "next";
import { AuthFlow } from "../auth-flow";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return <AuthFlow logIn heading="Start building" description="Sign up to start building." />;
}
