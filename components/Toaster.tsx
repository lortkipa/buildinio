"use client";

import { CircleCheck, CircleX, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { Toaster as Sonner } from "sonner";
import type { CSSProperties } from "react";
import { useAppearance } from "@/components/AppearanceProvider";

/** Toast messages in the app's colors and the account's saved theme. */
export function Toaster() {
  const { theme } = useAppearance();
  return (
    <Sonner
      position="top-center"
      theme={theme}
      icons={{
        success: <CircleCheck size={18} className="text-emerald-600 dark:text-emerald-400" />,
        error: <CircleX size={18} className="text-error" />,
        warning: <TriangleAlert size={18} className="text-amber-500 dark:text-amber-400" />,
        info: <Info size={18} className="text-muted" />,
        loading: <LoaderCircle size={18} className="text-muted motion-safe:animate-spin" />,
      }}
      toastOptions={{ className: "font-sans! text-sm! rounded-2xl! gap-3!" }}
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-border": "var(--border)",
          "--normal-text": "var(--foreground)",
        } as CSSProperties
      }
    />
  );
}
