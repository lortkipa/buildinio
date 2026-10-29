import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import { Onest } from "next/font/google";
import favicon from "@/brand/favicon.svg";
import favicon32 from "@/brand/favicon-32.png";
import appleTouchIcon from "@/brand/apple-touch-icon.png";
import { Toaster } from "@/components/Toaster";
import { AppearanceProvider } from "@/components/AppearanceProvider";
import { getCurrentUser } from "@/lib/auth/session";
import { DEFAULT_APPEARANCE } from "@/lib/settings";
import "./globals.css";

// Onest is the brand wordmark font.
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Every page's title ends in " - Buildinio"; pages set just their own part.
  title: {
    template: "%s - Buildinio",
    default: "Build an app by describing it - Buildinio",
  },
  description:
    "An app builder for people who don't write code. Describe what you need and buildinio builds it.",
  icons: {
    icon: [
      { url: favicon.src, type: "image/svg+xml" },
      { url: favicon32.src, sizes: "32x32", type: "image/png" },
    ],
    apple: appleTouchIcon.src,
  },
};

export const viewport: Viewport = {
  // Android Chrome: the keyboard shrinks the page instead of sliding over it,
  // so the prompt box can sit right above it. iOS ignores this.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${onest.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <Suspense>
          <UserAppearance>{children}</UserAppearance>
        </Suspense>
      </body>
    </html>
  );
}

async function UserAppearance({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const appearance = user ? { theme: user.theme, reducedMotion: user.reducedMotion } : DEFAULT_APPEARANCE;
  return (
    <AppearanceProvider appearance={appearance}>
      {children}
      <Toaster />
    </AppearanceProvider>
  );
}
