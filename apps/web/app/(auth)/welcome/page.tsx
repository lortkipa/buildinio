import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "../../session";
import { SiteHeader } from "../../site-header";
import { AuthPanel } from "../auth-panel";
import { NameForm } from "../name-form";

export const metadata: Metadata = { title: "Welcome" };

// Right after an account is created, and until its name is confirmed. There is no Back: the
// account exists by now, and the sign-in pages would only send the user back here.
export default async function WelcomePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.onboarded) redirect("/");

  return (
    <>
      <SiteHeader />
      <AuthPanel
        heading="What should we call you?"
        description="This is how you’ll appear in Buildinio."
      >
        <NameForm defaultName={session.user.name} />
      </AuthPanel>
    </>
  );
}
