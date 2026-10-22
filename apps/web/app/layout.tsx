import type { Metadata, Viewport } from "next";
import { Gabarito } from "next/font/google";
import "./globals.css";

// The wordmark's typeface, used for display headings (font-display).
const gabarito = Gabarito({ subsets: ["latin"], variable: "--font-gabarito" });

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
      </body>
    </html>
  );
}
