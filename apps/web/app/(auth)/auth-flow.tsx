"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "../site-header";
import { AuthPanel, ProviderButtons } from "./auth-panel";
import { CodeForm } from "./code-form";
import { EmailForm } from "./email-form";
import { CODE_LENGTH, type SendResult } from "./mock-auth";

// /login and /signup: the email step, then, on the same page, the step for the code sent to it.
export function AuthFlow({
  heading,
  description,
  logIn,
  signUp,
}: {
  heading: string;
  description: string;
  logIn?: boolean;
  signUp?: boolean;
}) {
  const [sent, setSent] = useState<{ email: string; result: SendResult } | null>(null);
  // Fills in the email form again after going back.
  const [lastEmail, setLastEmail] = useState("");

  // The code step has its own history entry (see handleSent), so leaving it is going back in
  // history, from the header's Back button as well as the browser's and the phone's.
  useEffect(() => {
    const onPopState = () => setSent(null);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function handleSent(email: string, result: SendResult) {
    setLastEmail(email);
    setSent({ email, result });
    // Same URL. Next.js copies its own state into the entry, so going back to it doesn't reload.
    window.history.pushState(null, "");
  }

  return (
    <>
      <SiteHeader
        logIn={logIn}
        signUp={signUp}
        onBack={sent ? () => window.history.back() : undefined}
      />
      {sent ? (
        <AuthPanel
          heading="Check your email"
          description={
            <>
              We sent a {CODE_LENGTH}-digit code to{" "}
              <span className="font-medium wrap-anywhere text-zinc-950 dark:text-white">
                {sent.email}
              </span>
              .
            </>
          }
        >
          <CodeForm email={sent.email} sent={sent.result} />
        </AuthPanel>
      ) : (
        <AuthPanel heading={heading} description={description}>
          <div className="flex flex-col gap-3">
            <ProviderButtons />
            <EmailForm defaultEmail={lastEmail} autoFocus={lastEmail !== ""} onSent={handleSent} />
          </div>
        </AuthPanel>
      )}
    </>
  );
}
