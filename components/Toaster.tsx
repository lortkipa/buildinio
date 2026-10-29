"use client";

import { CircleCheck, CircleX, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { Toaster as Sonner } from "sonner";
import type { CSSProperties } from "react";
import { useTheme } from "@/lib/account/store";

/** Toast messages (from `toast` in sonner), in the app's colors and the user's theme. */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      theme={useTheme()}
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
