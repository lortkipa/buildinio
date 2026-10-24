"use client";

import { useEffect } from "react";
import { ErrorContent } from "./error";
import { gabarito } from "./fonts";
import "./globals.css";

// When the root layout itself throws: the same page as error.tsx, in a document of its own, since
// it replaces the layout.
export default function GlobalError({
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
    <html lang="en" className={gabarito.variable}>
      <body className="min-h-dvh bg-page text-zinc-950 antialiased dark:text-zinc-50">
        <title>Something went wrong · Buildinio</title>
        <ErrorContent digest={error.digest} retry={retry} />
      </body>
    </html>
  );
}
