import { Gabarito } from "next/font/google";

// The wordmark's typeface, used for display headings (font-display). Here rather than in the root
// layout, since global-error.tsx replaces the layout and needs it too.
export const gabarito = Gabarito({ subsets: ["latin"], variable: "--font-gabarito" });
