import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import favicon from "@/brand/favicon.svg";
import favicon32 from "@/brand/favicon-32.png";
import appleTouchIcon from "@/brand/apple-touch-icon.png";
import { Toaster } from "@/components/Toaster";
import { THEME_COLORS } from "@/lib/account/options";
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
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The signed-in user's theme is set on it before it hydrates (see useApplyTheme).
    <html lang="en" suppressHydrationWarning className={`${onest.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
