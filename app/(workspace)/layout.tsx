import { Suspense } from "react";
import { cookies } from "next/headers";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth/session";
import { parsePreview, PREVIEW_OPEN_COOKIE, PREVIEW_WIDTH_COOKIE } from "@/lib/preview";
import { parseSidebar, SIDEBAR_COLLAPSED_COOKIE, SIDEBAR_WIDTH_COOKIE } from "@/lib/sidebar";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <WorkspaceShell>{children}</WorkspaceShell>
    </Suspense>
  );
}

async function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return children;

  const store = await cookies();
  const sidebar = parseSidebar(
    store.get(SIDEBAR_WIDTH_COOKIE)?.value,
    store.get(SIDEBAR_COLLAPSED_COOKIE)?.value,
  );
  const preview = parsePreview(
    store.get(PREVIEW_WIDTH_COOKIE)?.value,
    store.get(PREVIEW_OPEN_COOKIE)?.value,
  );

  // Keep the frame mounted when moving between New and project chats.
  return (
    <AppShell key={user.id} user={user} sidebar={sidebar} preview={preview}>
      {children}
    </AppShell>
  );
}
