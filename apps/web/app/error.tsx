"use client";

import { useEffect } from "react";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./buttons";
import { STATUS_ACTION, StatusPage } from "./status-page";

/*
 * A page that threw while rendering, in place of everything under the root layout (the sidebar
 * too, as the layouts that add it are inside). Try again renders it again, fetching it anew from
 * the server. Go home loads home from scratch, in case what broke is held in the browser.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <title>Something went wrong · Buildinio</title>
      <ErrorContent digest={error.digest} retry={retry} />
    </>
  );
}

// Shared with global-error.tsx.
export function ErrorContent({ digest, retry }: { digest?: string; retry: () => void }) {
  return (
    <StatusPage
      heading="Something went wrong"
      description="This page ran into a problem. Try again, or go back home."
      // A server error's ID, which matches its entry in the server's logs.
      footnote={
        digest && (
          <>
            Error ID <span className="font-mono select-all">{digest}</span>
          </>
        )
      }
    >
      <button type="button" onClick={retry} className={PRIMARY_BUTTON}>
        Try again
      </button>
      {/* A plain link, not next/link, for a full page load. */}
      <a href="/" className={`${STATUS_ACTION} ${SECONDARY_BUTTON}`}>
        Go home
      </a>
    </StatusPage>
  );
}
