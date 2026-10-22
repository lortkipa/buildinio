"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "../site-header";
import { Toast, useToast } from "../toast";
import { AuthPanel } from "./auth-panel";
import { CodeForm } from "./code-form";
import { CODE_LENGTH, type SentCode } from "./email-code";
import { EmailForm } from "./email-form";
import { callbackErrorMessage, ProviderButtons } from "./provider-buttons";

// /login and /signup: the email step, then, on the same page, the step for the code sent to it.
// error: the ?error= Better Auth adds when signing in with Google or GitHub failed.
export function AuthFlow({
  heading,
  description,
  logIn,
  signUp,
  error,
}: {
  heading: string;
  description: string;
  logIn?: boolean;
  signUp?: boolean;
  error?: string;
}) {
  const [sent, setSent] = useState<{ email: string; code: SentCode } | null>(null);
  // Fills in the email form again after going back.
  const [lastEmail, setLastEmail] = useState("");
  const { toast, showToast, closeToast } = useToast(error && callbackErrorMessage(error));

  // Shown once: drop it from the URL so a reload doesn't show it again.
  useEffect(() => {
    if (error) window.history.replaceState(null, "", window.location.pathname);
  }, [error]);

  // The code step has its own history entry (see handleSent), so leaving it is going back in
  // history, from the header's Back button as well as the browser's and the phone's.
  useEffect(() => {
    const onPopState = () => setSent(null);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function handleSent(email: string, code: SentCode) {
    setLastEmail(email);
    setSent({ email, code });
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
          <CodeForm email={sent.email} sent={sent.code} />
        </AuthPanel>
      ) : (
        <AuthPanel heading={heading} description={description}>
          <div className="flex flex-col gap-3">
            <ProviderButtons onError={showToast} />
            <EmailForm
              defaultEmail={lastEmail}
              autoFocus={lastEmail !== ""}
              onSent={handleSent}
              onError={showToast}
            />
          </div>
        </AuthPanel>
      )}
      <Toast toast={toast} onClose={closeToast} />
    </>
  );
}
