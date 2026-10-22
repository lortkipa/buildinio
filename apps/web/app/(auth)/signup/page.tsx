import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "../../session";
import { AuthFlow } from "../auth-flow";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  if (await getSession()) redirect("/");
  const { error } = await searchParams;
  return (
    <AuthFlow
      logIn
      heading="Start building"
      description="Sign up to start building."
      error={typeof error === "string" ? error : undefined}
    />
  );
}
