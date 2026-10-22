import type { Metadata } from "next";
import { AuthFlow } from "../auth-flow";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return <AuthFlow signUp heading="Welcome back" description="Log in to keep building." />;
}
