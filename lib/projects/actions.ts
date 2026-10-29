"use server";

// What the project UI asks the server to do, besides talking to the AI (that's the
// turn route, app/api/projects/[id]/turn). Each one checks who's asking.

import { stopAnswer as stop } from "@/lib/ai/registry";
import { getCurrentUser } from "@/lib/auth/session";
import { COLOR_NAMES, ICON_NAMES, MAX_PROJECT_NAME } from "@/lib/projects/options";
import type { ProjectColor, ProjectIcon } from "@/lib/projects/options";
import { announceChange } from "@/lib/projects/changes";
import * as projects from "@/lib/projects/server";
import { isId } from "@/lib/projects/ids";

/** The project, if it's the signed-in user's. */
async function ownProject(id: unknown) {
  const user = await getCurrentUser();
  return user && isId(id) ? projects.getProject(user.id, id) : null;
}

export async function editProject(id: unknown, changes: { name: unknown; icon: unknown; color: unknown }) {
  const name = typeof changes.name === "string" ? changes.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > MAX_PROJECT_NAME) return;
  if (!ICON_NAMES.includes(changes.icon as ProjectIcon) || !COLOR_NAMES.includes(changes.color as ProjectColor)) return;
  const project = await ownProject(id);
  if (!project) return;
  projects.updateProject(project.id, { name, icon: changes.icon as ProjectIcon, color: changes.color as ProjectColor });
}

/** Stop: the AI's answer ends and everything it did is undone (see lib/ai/runs.ts). */
export async function stopAnswer(id: unknown) {
  const user = await getCurrentUser();
  if (user && isId(id)) stop(id, user.id);
}

/** Deletes the project with its chat and its code, stopping the AI if it's working on it. */
export async function deleteProject(id: unknown) {
  const project = await ownProject(id);
  if (project) await projects.removeProject(project.id);
}

export async function setFeedback(projectId: unknown, messageId: unknown, feedback: unknown) {
  if (feedback !== "like" && feedback !== "dislike" && feedback !== null) return;
  const project = await ownProject(projectId);
  if (project && typeof messageId === "string") projects.setFeedback(project.id, messageId, feedback);
}

/** Who can open the app's share link: only its owner, or anyone with the link. */
export async function setVisibility(id: unknown, visibility: unknown) {
  if (visibility !== "private" && visibility !== "public") return;
  const project = await ownProject(id);
  if (!project) return;
  projects.updateProject(project.id, { visibility });
  announceChange(project.id); // Its share page opens or closes at once.
}

/** The app's preview was seen, or its "ready" card dismissed. */
export async function markPreviewSeen(id: unknown) {
  const project = await ownProject(id);
  if (project?.ready) projects.updateProject(project.id, { ready: false });
}
