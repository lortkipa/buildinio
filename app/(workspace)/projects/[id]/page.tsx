import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProjectChat } from "@/components/ProjectChat";
import { getCurrentUser } from "@/lib/auth/session";

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
  return <ProjectChat id={id} />;
}
