"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Watermark } from "@/components/Watermark";
import { usePlayOnce } from "@/components/usePlayOnce";
import { APP_SANDBOX } from "@/lib/preview";

type SharedAppProps = {
  id: string;
  name: string | null;
  appVersion: number; // As the page was rendered; newer builds come from app/api/share.
  notBuilt: ReactNode; // Shown until there's a first version.
};

/**
 * The app at its share link, full screen with the badge. A new build shows up without a
 * refresh, like in the preview: the server says when (app/api/share/[id]).
 */
export function SharedApp({ id, name, appVersion: initial, notBuilt }: SharedAppProps) {
  const [appVersion, setAppVersion] = useState(initial);

  // Reconnects by itself if the connection drops; stops if the app is made private or deleted.
  useEffect(() => {
    const events = new EventSource(`/api/share/${id}`);
    events.onmessage = (event) => {
      const version = Number(event.data);
      if (Number.isInteger(version)) setAppVersion((current) => Math.max(current, version));
    };
    return () => events.close();
  }, [id]);

  if (appVersion === 0) return notBuilt;
  return (
    <>
      <AppFrame key={appVersion} id={id} name={name} appVersion={appVersion} built={appVersion !== initial} />
      <Watermark />
    </>
  );
}

/** Sandboxed like the preview (app/preview checks who's asking too). A just-built version appears. */
function AppFrame({ id, name, appVersion, built }: { id: string; name: string | null; appVersion: number; built: boolean }) {
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
