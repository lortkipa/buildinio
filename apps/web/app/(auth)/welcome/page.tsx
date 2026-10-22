import type { Metadata } from "next";
import { AuthPanel } from "../auth-panel";
import { NameForm } from "../name-form";
import { WelcomeHeader } from "./welcome-header";

export const metadata: Metadata = { title: "Welcome" };

// After signing in with Google, GitHub or an email code. Not guarded yet: there are no sessions.
export default function WelcomePage() {
  return (
    <>
      <WelcomeHeader />
      <AuthPanel
        heading="What should we call you?"
        description="This is how you’ll appear in Buildinio."
      >
        <NameForm />
      </AuthPanel>
    </>
  );
}
