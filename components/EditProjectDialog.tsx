"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Check } from "lucide-react";
import { ProjectTile } from "@/components/ProjectTile";
import { dialogButton, dialogPanel } from "@/components/styles";
import {
  COLOR_NAMES,
  ICON_NAMES,
  MAX_PROJECT_NAME,
  PROJECT_COLORS,
  PROJECT_ICONS,
} from "@/lib/projects/options";
import { editProject } from "@/lib/projects/store";
import type { Project } from "@/lib/projects/types";

const textInput =
  "h-11 w-full rounded-full border border-border bg-surface px-5 text-base text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/40";
const optionFocus =
  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foreground";

/** "shopping-bag" → "Shopping bag", for screen readers. */
function spoken(value: string) {
  const words = value.replace(/-/g, " ");
  return words[0].toUpperCase() + words.slice(1);
}

type EditProjectDialogProps = {
  project: Project;
  onClose: () => void;
};

/** Pick the project's name, color and icon. Opens when it mounts. */
export function EditProjectDialog({ project, onClose }: EditProjectDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [name, setName] = useState(project.name ?? "");
  const [icon, setIcon] = useState(project.icon);
  const [color, setColor] = useState(project.color);
  const cleanName = name.trim().replace(/\s+/g, " ");

  // Desktop starts in the name. On touch, the keyboard would cover the colors and icons.
  useEffect(() => {
    ref.current?.showModal();
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.select();
    else ref.current?.focus();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cleanName) return;
    editProject(project.id, { name: cleanName, icon, color });
    ref.current?.close();
  }

  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      className={`max-h-[calc(100dvh-2rem)] max-w-md overflow-y-auto outline-none ${dialogPanel}`}
    >
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-4">
          <ProjectTile icon={icon} color={color} size="lg" />
          <h2 id={`${id}-title`} className="text-lg font-semibold tracking-[-0.01em]">
            Edit project
          </h2>
        </div>

        <label htmlFor={`${id}-name`} className="mt-6 block text-sm font-medium">
          Name
        </label>
        <input
          ref={inputRef}
          id={`${id}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_PROJECT_NAME}
          autoComplete="off"
          placeholder="Name your app"
          className={`mt-2 ${textInput}`}
        />

        <fieldset className="mt-5">
          <legend className="text-sm font-medium">Color</legend>
          <div className="mt-2 grid grid-cols-10 gap-1.5 sm:gap-2">
            {COLOR_NAMES.map((value) => (
              <label key={value} className="relative grid aspect-square max-w-8 cursor-pointer">
                <input
                  type="radio"
                  name={`${id}-color`}
                  value={value}
                  checked={color === value}
                  onChange={() => setColor(value)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  style={{ backgroundColor: PROJECT_COLORS[value] }}
                  className={`col-start-1 row-start-1 rounded-full transition-transform hover:scale-110 ${optionFocus}`}
                />
                <Check
                  aria-hidden
                  size={16}
                  strokeWidth={3}
                  className={`pointer-events-none col-start-1 row-start-1 m-auto text-white transition duration-200 ${
                    color === value ? "scale-100 opacity-100" : "scale-50 opacity-0"
                  }`}
                />
                <span className="sr-only">{spoken(value)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium">Icon</legend>
          <div className="mt-2 grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {ICON_NAMES.map((value) => {
              const Icon = PROJECT_ICONS[value];
              const checked = icon === value;
              return (
                <label key={value} className="relative grid cursor-pointer">
                  <input
                    type="radio"
                    name={`${id}-icon`}
                    value={value}
                    checked={checked}
                    onChange={() => setIcon(value)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    style={checked ? { backgroundColor: PROJECT_COLORS[color] } : undefined}
                    className={`grid aspect-square place-items-center rounded-xl transition-colors ${optionFocus} ${
                      checked ? "text-white" : "text-muted hover:bg-foreground/5 hover:text-foreground"
                    }`}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="sr-only">{spoken(value)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className={`${dialogButton} border border-border bg-surface enabled:hover:border-foreground/25`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!cleanName}
            className={`${dialogButton} bg-foreground text-background enabled:hover:bg-foreground/85`}
          >
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
