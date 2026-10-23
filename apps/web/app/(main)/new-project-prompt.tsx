"use client";

import { useRouter } from "next/navigation";
import { createProject } from "../projects";
import { PromptInput } from "../prompt-input";

// The home page's prompt: sending it starts a project (mocked, see projects.ts) and opens its chat.
export function NewProjectPrompt() {
  const router = useRouter();
  return <PromptInput onSend={(prompt) => router.push(`/projects/${createProject(prompt)}`)} />;
}
