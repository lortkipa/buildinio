"use client";

import { useId } from "react";
import { CANCEL_BUTTON, PRIMARY_BUTTON } from "./dialog";

/*
 * Pieces shared by the settings tabs (settings-dialog.tsx).
 */

// A text field or select. text-base: iOS zooms into fields with smaller text.
const FIELD_BASE =
  "h-12 w-full rounded-2xl border border-zinc-950/10 bg-white px-4 text-base outline-none transition-colors placeholder:text-zinc-500 dark:border-white/10 dark:bg-zinc-950/40 dark:placeholder:text-zinc-400";
export const FIELD = `${FIELD_BASE} focus:border-brand-violet`;
// For confirming something that can't be undone.
export const DANGER_FIELD = `${FIELD_BASE} focus:border-red-600 dark:focus:border-red-400`;

export const LABEL = "block text-sm font-medium";
// A line about a setting, under its label or heading.
export const HINT = "text-sm text-pretty text-zinc-600 dark:text-zinc-300";

// A group of settings in a tab, under its heading, e.g. Theme. A line sets off each one after the first.
export function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="border-zinc-950/10 not-first:mt-6 not-first:border-t not-first:pt-6 dark:border-white/10"
    >
      <h4 id={id} className="text-sm font-semibold">
        {title}
      </h4>
      {description && <p className={`mt-1 ${HINT}`}>{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/*
 * A form's Save, and Cancel, which puts back what changed and shows only then. Nothing is saved
 * yet: the forms' Save does nothing.
 */
export function FormButtons({
  changed,
  canSave = changed,
  onCancel,
}: {
  changed: boolean;
  canSave?: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      {changed && (
        <button
          type="button"
          onClick={onCancel}
          className={`animate-tile-in motion-reduce:animate-none ${CANCEL_BUTTON}`}
        >
          Cancel
        </button>
      )}
      <button type="submit" disabled={!canSave} className={PRIMARY_BUTTON}>
        Save
      </button>
    </div>
  );
}
