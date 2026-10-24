import type { Metadata, Viewport } from "next";
import { gabarito } from "./fonts";
import "./globals.css";
import { Tooltips } from "./tooltips";

export const metadata: Metadata = {
  // Pages set only their own name, e.g. "Log in · Buildinio".
  title: { default: "Buildinio", template: "%s · Buildinio" },
  description: "An AI app builder for non-technical people.",
};

// Same colors as --color-page in globals.css.
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#09090f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={gabarito.variable}>
      <body className="min-h-dvh bg-page text-zinc-950 antialiased dark:text-zinc-50">
        {children}
        <Tooltips />
      </body>
    </html>
  );
}
