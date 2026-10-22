import type { Metadata } from "next";
import { SiteHeader } from "../../site-header";
import { AuthPanel } from "../auth-panel";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <>
      <SiteHeader logIn />
      <AuthPanel
        heading="Start building"
        description="Sign up to start building."
      />
    </>
  );
}
