import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "../app-shell";
import { PREVIEW_COOKIE, parsePreviewState } from "../preview-state";
import { getSession } from "../session";
import { parseSidebarState, SIDEBAR_COOKIE } from "../sidebar-state";

/*
 * Around home and the project pages. Signed in, the sidebar (AppShell), which stays mounted while
 * moving between them. It renders as the user left it, as does a project's preview (cookies in
 * sidebar-state.ts and preview-state.ts). Signed out, nothing: home is the landing page, and the
 * other pages send the user to log in.
 */
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) return children;
  // The name is asked once, right after the account is created; this catches a skipped name step.
  if (!session.user.onboarded) redirect("/welcome");

  const { name, email, image } = session.user;
  const cookieStore = await cookies();
  const sidebar = parseSidebarState(cookieStore.get(SIDEBAR_COOKIE)?.value);
  const preview = parsePreviewState(cookieStore.get(PREVIEW_COOKIE)?.value);

  return (
    <AppShell user={{ name, email, image }} sidebar={sidebar} preview={preview}>
      {children}
    </AppShell>
  );
}
