import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ProjectChat } from "@/components/ProjectChat";
import { ProjectTitle } from "@/components/ProjectTile";
import { getCurrentUser } from "@/lib/auth/session";
import { parseSidebar, SIDEBAR_COLLAPSED_COOKIE, SIDEBAR_WIDTH_COOKIE } from "@/lib/sidebar";

export const metadata: Metadata = {
  title: "Project",
};

// Projects live in the browser for now (lib/projects/store.ts), so the chat fills in there.
export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return (
    <Suspense>
      <ProjectContent params={params} />
    </Suspense>
  );
}

async function ProjectContent({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const { id } = await params;
  const store = await cookies();
  const sidebar = parseSidebar(
    store.get(SIDEBAR_WIDTH_COOKIE)?.value,
    store.get(SIDEBAR_COLLAPSED_COOKIE)?.value,
  );
  // Keyed by user, so nothing carries over from someone else.
  return (
    <AppShell key={user.id} user={user} sidebar={sidebar} title={<ProjectTitle id={id} />}>
      <ProjectChat id={id} />
    </AppShell>
  );
}
