"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Check, Globe, Lock, Share } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CopyButton } from "@/components/MessageActions";
import { placeMenu } from "@/components/ProjectActions";
import { circleButton, menuPanel } from "@/components/styles";
import { setVisibility, useProject } from "@/lib/projects/store";
import type { Project, Visibility } from "@/lib/projects/types";

const VISIBILITY_OPTIONS: { value: Visibility; label: string; description: string; icon: LucideIcon }[] = [
  { value: "private", label: "Private", description: "Only you can open it", icon: Lock },
  { value: "public", label: "Public", description: "Anyone with the link", icon: Globe },
];

/**
 * Shares the app on its own (app/share): a pop-up with who can open its link and the
 * link to copy. Next to the preview while it shows.
 */
export function ShareButton({ projectId }: { projectId: string }) {
  const { project } = useProject(projectId);
  const pathname = usePathname();
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null); // Set while it's open.
  const id = useId();
  const close = useCallback(() => setTrigger(null), []);

  // Close on navigation and when the layout is hidden.
  useLayoutEffect(() => () => setTrigger(null), [pathname]);

  if (!project) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Share"
        aria-haspopup="dialog"
        aria-expanded={trigger !== null}
        aria-controls={trigger ? id : undefined}
        onClick={(event) => {
          const button = event.currentTarget;
          setTrigger((open) => (open ? null : button));
        }}
        className={`${circleButton} aria-expanded:bg-foreground/5 aria-expanded:text-foreground`}
      >
        <Share size={18} aria-hidden />
      </button>
      {trigger && <SharePopup id={id} project={project} trigger={trigger} onClose={close} />}
    </>
  );
}

type SharePopupProps = {
  id: string;
  project: Project;
  trigger: HTMLButtonElement; // The share button, to toggle and to get focus back.
  onClose: () => void;
};

function SharePopup({ id, project, trigger, onClose }: SharePopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const link = `${window.location.origin}/share/${project.id}`;

  // Under the button, kept on screen. Focus moves to the chosen option.
  useLayoutEffect(() => {
    const popup = ref.current;
    if (!popup) return;
    placeMenu(popup, { rect: trigger.getBoundingClientRect(), from: "button" });
    popup.querySelector<HTMLInputElement>("input:checked")?.focus();
  }, [trigger]);

  // Close on a click outside, Escape or resizing.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !trigger.contains(target)) onClose();
    };
    // Captured and marked handled, so the phone preview around it stays open.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
      trigger.focus();
    };
    // A click in the app's frame doesn't reach this page, but takes the focus away from it.
    const onBlur = () => onClose();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose, trigger]);

  // Inside the phone preview while it's open, which covers the screen, so it stays part of it.
  const container = trigger.closest<HTMLElement>("[role=dialog]") ?? document.body;
  return createPortal(
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-label="Share"
      className={`fixed top-0 left-0 z-50 w-72 max-w-[calc(100%-1rem)] ${menuPanel}`}
    >
      <fieldset>
        <legend className="px-3 pt-1.5 pb-1 text-xs font-medium text-muted">Who can open the link</legend>
        {VISIBILITY_OPTIONS.map(({ value, label, description, icon: Icon }) => {
          const checked = project.visibility === value;
          return (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-foreground/5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foreground"
            >
              <input
                type="radio"
                name={`${id}-visibility`}
                value={value}
                checked={checked}
                onChange={() => setVisibility(project.id, value)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors ${
                  checked ? "bg-foreground text-background" : "bg-foreground/5 text-muted"
                }`}
              >
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted">{description}</span>
              </span>
              <Check
                size={16}
                strokeWidth={2.5}
                aria-hidden
                className={`shrink-0 transition duration-200 ease-out motion-reduce:transition-none ${
                  checked ? "scale-100 opacity-100" : "scale-50 opacity-0"
                }`}
              />
            </label>
          );
        })}
      </fieldset>
      <div aria-hidden className="mx-1.5 my-1.5 h-px bg-border" />
      <div className="flex h-10 items-center gap-1 rounded-xl bg-foreground/5 pr-1 pl-3">
        <p className="fade-end min-w-0 flex-1 text-sm text-muted">{link.replace(/^https?:\/\//, "")}</p>
        <CopyButton text={link} label="Copy link" />
      </div>
    </div>,
    container,
  );
}
