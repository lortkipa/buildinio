import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { focusRing } from "@/components/styles";
import { Watermark } from "@/components/Watermark";
import { getCurrentUser } from "@/lib/auth/session";
import { APP_SANDBOX } from "@/lib/preview";
import { isId } from "@/lib/projects/ids";
import { getSharedApp } from "@/lib/projects/server";

// An app on its own, at the link its owner shares: full screen, without Buildinio around
// it, but with a "Build with Buildinio" badge. Anyone can open a public app's link; a
// private one opens only for its owner.

/** The app at this link, if whoever's asking may see it. */
async function sharedApp(params: Promise<{ id: string }>) {
  const { id } = await params;
  const user = await getCurrentUser();
  const app = isId(id) ? getSharedApp(id, user?.id ?? null) : null;
  return app && { id, ...app };
}

// The app's own name, without " - Buildinio": it's their app.
export async function generateMetadata({ params }: PageProps<"/share/[id]">): Promise<Metadata> {
  const app = await sharedApp(params);
  return { title: app ? { absolute: app.name ?? "New app" } : "App not available" };
}

export default function SharePage({ params }: PageProps<"/share/[id]">) {
  return (
    <Suspense>
      <SharedApp params={params} />
    </Suspense>
  );
}

async function SharedApp({ params }: { params: Promise<{ id: string }> }) {
  const app = await sharedApp(params);
  // The same for a private app as for one that doesn't exist.
  if (!app) return <Notice title="This app isn’t available" text="It may be private, or it was deleted." />;
  if (app.appVersion === 0) return <Notice title="Nothing to see yet" text="This app hasn’t been built yet." />;

  return (
    <>
      {/* Sandboxed like the preview (app/preview checks who's asking too). */}
      <iframe
        src={`/preview/${app.id}/index.html?v=${app.appVersion}`}
        title={app.name ?? "App"}
        sandbox={APP_SANDBOX}
        className="fixed inset-0 size-full bg-white"
      />
      <Watermark />
    </>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="mt-2 text-muted">{text}</p>
      <Link
        href="/"
        className={`mt-6 flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 ${focusRing}`}
      >
        Build your own app
      </Link>
    </main>
  );
}
