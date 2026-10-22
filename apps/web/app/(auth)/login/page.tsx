import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "../../session";
import { AuthFlow } from "../auth-flow";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getSession()) redirect("/");
  const { error } = await searchParams;
  return (
    <AuthFlow
      signUp
      heading="Welcome back"
      description="Log in to keep building."
      error={typeof error === "string" ? error : undefined}
    />
  );
}
