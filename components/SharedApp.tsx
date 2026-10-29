"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Watermark } from "@/components/Watermark";
import { usePlayOnce } from "@/components/usePlayOnce";
import { APP_SANDBOX } from "@/lib/preview";
import type { SharedAppState } from "@/lib/projects/types";

type SharedAppProps = {
  id: string;
  state: SharedAppState; // As the page was rendered; changes come from app/api/share.
  unavailable: ReactNode; // Private (and not the owner's), or deleted.
  notBuilt: ReactNode; // No first version yet.
};

/**
 * The app at its share link, full screen with the badge. It follows the app without a
 * refresh, like the preview does: a new build shows up, and turning it private or public
 * (or deleting it) closes or opens it at once. The server says when (app/api/share/[id]).
 */
export function SharedApp({ id, state: initial, unavailable, notBuilt }: SharedAppProps) {
  const [state, setState] = useState(initial);
  const loadedVersion = initial.available ? initial.appVersion : 0;

  // Reconnects by itself if the connection drops.
  useEffect(() => {
    const events = new EventSource(`/api/share/${id}`);
    events.onmessage = (event) => setState(JSON.parse(event.data) as SharedAppState);
    return () => events.close();
  }, [id]);

  // The tab's title follows too (the page's own is for how it was when it loaded).
  useEffect(() => {
    if (state === initial) return;
    document.title = state.available ? (state.name ?? "New app") : "App not available - Buildinio";
  }, [state, initial]);

  if (!state.available) return unavailable;
  if (state.appVersion === 0) return notBuilt;
  return (
    <>
      <AppFrame
        key={state.appVersion}
        id={id}
        name={state.name}
        appVersion={state.appVersion}
        built={state.appVersion > loadedVersion}
      />
      <Watermark />
    </>
  );
}

type AppFrameProps = { id: string; name: string | null; appVersion: number; built: boolean };

/** Sandboxed like the preview (app/preview checks who's asking too). A just-built version appears. */
function AppFrame({ id, name, appVersion, built }: AppFrameProps) {
  const enter = usePlayOnce("motion-safe:animate-enter", built);
  return (
    <iframe
      src={`/preview/${id}/index.html?v=${appVersion}`}
      title={name ?? "App"}
      sandbox={APP_SANDBOX}
      onAnimationEnd={enter.onAnimationEnd}
      className={`fixed inset-0 size-full bg-white ${enter.className}`}
    />
  );
}
