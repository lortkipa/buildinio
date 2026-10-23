import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProjectChat } from "../../../project-chat";
import { getSession } from "../../../session";

// The projects live in the browser (projects.ts), so the server doesn't know the name.
export const metadata: Metadata = { title: "Project" };

// A project's chat. The layout adds the sidebar, with the project's name in the top bar.
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) redirect("/login");
  const { id } = await params;
  return <ProjectChat id={id} />;
}
