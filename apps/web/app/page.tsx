import type { ServiceState, StatusResponse } from "@buildinio/shared";
import { RefreshButton } from "./refresh-button";

// Check live on every request instead of at build time.
export const dynamic = "force-dynamic";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

type ApiResult =
  | { ok: true; status: StatusResponse; responseMs: number }
  | { ok: false; error: string; responseMs: number };

async function fetchStatus(): Promise<ApiResult> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  try {
    const res = await fetch(`${API_URL}/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, responseMs: elapsed() };
    return { ok: true, status: (await res.json()) as StatusResponse, responseMs: elapsed() };
  } catch (error) {
    // Node's fetch reports "fetch failed"; the cause has the real reason (e.g. ECONNREFUSED).
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
      responseMs: elapsed(),
    };
  }
}

export default async function Home() {
  const result = await fetchStatus();
  const database = result.ok ? result.status.database : undefined;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-16">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcSet="/brand/buildinio-logo-dark-bg.svg" />
        <img src="/brand/buildinio-logo-light-bg.svg" alt="Buildinio" width={240} height={47} />
      </picture>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">System status</h1>
          <RefreshButton />
        </div>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          <StatusRow name="Web" state="ok" detail="Next.js server is rendering this page" />
          <StatusRow
            name="API"
            state={result.ok ? "ok" : "error"}
            detail={
              result.ok
                ? `v${result.status.api.version} · up ${result.status.api.uptimeSeconds}s · ${result.responseMs} ms`
                : `Unreachable at ${API_URL}: ${result.error}`
            }
          />
          <StatusRow
            name="Database"
            state={database?.status ?? "error"}
            detail={
              !database
                ? "Unknown: the API did not respond"
                : database.status === "ok"
                  ? `${database.version?.split(" on ")[0] ?? "PostgreSQL"} · ${database.latencyMs} ms`
                  : `Error: ${database.error}`
            }
          />
        </ul>
      </section>

      <p className="text-sm text-zinc-500">Checked at {new Date().toISOString()}</p>
    </main>
  );
}

function StatusRow({ name, state, detail }: { name: string; state: ServiceState; detail: string }) {
  const ok = state === "ok";
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        aria-hidden
        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
      />
      <div className="min-w-0">
        <p className="font-medium">
          {name}{" "}
          <span
            className={
              ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            }
          >
            {ok ? "Connected" : "Down"}
          </span>
        </p>
        <p className="break-words text-sm text-zinc-500 dark:text-zinc-400">{detail}</p>
      </div>
    </li>
  );
}
