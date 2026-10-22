import type { Metadata } from "next";
import { SiteHeader } from "../../site-header";
import { AuthPanel } from "../auth-panel";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <SiteHeader signUp />
      <AuthPanel heading="Welcome back" description="Log in to keep building." />
    </>
  );
}
