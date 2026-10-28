// Runs once when the server starts, before it handles any request.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrateDatabase } = await import("@/lib/db");
    migrateDatabase();
    // Code left behind by projects deleted while the server stopped.
    const { projectExists } = await import("@/lib/projects/server");
    const { pruneWorkspaces } = await import("@/lib/sandbox/workspace");
    await pruneWorkspaces(projectExists);
  }
}
