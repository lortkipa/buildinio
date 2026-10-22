"use client";

import { useRouter } from "next/navigation";
import { SiteHeader } from "../../site-header";

// Back returns to the sign-in step that led here: the email step of /login or /signup, since the
// code step's entry was replaced. Opened without any history (a new tab), it goes to /login.
export function WelcomeHeader() {
  const router = useRouter();
  return (
    <SiteHeader
      onBack={() => (window.history.length > 1 ? router.back() : router.replace("/login"))}
    />
  );
}
