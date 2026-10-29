"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AppWindow, Check, ChevronDown, Globe, Lock, Share } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Bone } from "@/components/Bone";
import { CopyButton } from "@/components/MessageActions";
import { placeMenu } from "@/components/ProjectActions";
import { circleButton, focusRing, menuItem, menuPanel } from "@/components/styles";
import { setVisibility, useProject } from "@/lib/projects/store";
import type { Project, Visibility } from "@/lib/projects/types";

const VISIBILITY_OPTIONS: { value: Visibility; label: string; description: string; icon: LucideIcon }[] = [
  { value: "private", label: "Private", description: "Only you can open it", icon: Lock },
  { value: "public", label: "Public", description: "Anyone with the link", icon: Globe },
];

/**
 * Shares the app on its own (app/share): a pop-up with who can open its link and the
 * link to copy, or, until there's an app, that it's being built. Next to the preview while
 * it shows.
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
  const pickerRef = useRef<HTMLButtonElement>(null);
  const choosingRef = useRef(false);
  const [choosing, setChoosing] = useState(false); // The visibility menu is open.
  const built = project.appVersion > 0;
  useEffect(() => {
    choosingRef.current = choosing;
  }, [choosing]);

  // Under the button, kept on screen, again when the build lands and it grows.
  useLayoutEffect(() => {
    if (ref.current) placeMenu(ref.current, { rect: trigger.getBoundingClientRect(), from: "button" });
  }, [trigger, built]);

  // Focus moves in: to who can open the link, or the pop-up itself while there's nothing to share.
  useLayoutEffect(() => {
    (pickerRef.current ?? ref.current)?.focus();
  }, []);

  // Close on a click outside, Escape or resizing.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !trigger.contains(target)) onClose();
    };
    // Captured and marked handled, so the phone preview around it stays open. The
    // visibility menu, if it's open, closes first.
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (choosingRef.current) {
        setChoosing(false);
        pickerRef.current?.focus();
        return;
      }
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
      tabIndex={-1}
      className={`fixed top-0 left-0 z-50 w-72 max-w-[calc(100%-1rem)] outline-none ${menuPanel}`}
    >
      {built ? (
        <>
          <VisibilityPicker
            id={id}
            project={project}
            open={choosing}
            onOpenChange={setChoosing}
            pickerRef={pickerRef}
          />
          <div aria-hidden className="mx-1.5 my-1.5 h-px bg-border" />
          <ShareLink projectId={project.id} />
        </>
      ) : project.turn ? (
        <Building />
      ) : (
        <NothingToShare />
      )}
    </div>,
    container,
  );
}

type VisibilityPickerProps = {
  id: string;
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickerRef: RefObject<HTMLButtonElement | null>;
};

/** Who can open the link: the current choice, opening a menu of both. */
function VisibilityPicker({ id, project, open, onOpenChange, pickerRef }: VisibilityPickerProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const current = VISIBILITY_OPTIONS.find((option) => option.value === project.visibility) ?? VISIBILITY_OPTIONS[0];

  // Focus on the chosen one when the menu opens. A click elsewhere in the pop-up closes it.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("[aria-checked=true]")?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !pickerRef.current?.contains(target)) onOpenChange(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, onOpenChange, pickerRef]);

  function choose(value: Visibility) {
    if (value !== project.visibility) setVisibility(project.id, value);
    onOpenChange(false);
    pickerRef.current?.focus();
  }

  // Arrow keys move between the two; Tab leaves the menu closed.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitemradio]") ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === "Tab") {
      onOpenChange(false);
    }
  }

  return (
    <div className="relative">
      <p id={`${id}-label`} className="px-3 pt-1.5 pb-1 text-xs font-medium text-muted">
        Who can open the link
      </p>
      <button
        ref={pickerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-current`}
        onClick={() => onOpenChange(!open)}
        className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-foreground/5 aria-expanded:bg-foreground/5 ${focusRing}`}
      >
        <VisibilityLabel option={current} labelId={`${id}-current`} />
        <ChevronDown
          size={16}
          aria-hidden
          className="shrink-0 text-muted transition-transform group-aria-expanded:rotate-180 motion-reduce:transition-none"
        />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Who can open the link"
          onKeyDown={handleKeyDown}
          className={`absolute inset-x-0 top-full z-10 mt-1 origin-top ${menuPanel}`}
        >
          {VISIBILITY_OPTIONS.map((option) => {
            const checked = option.value === project.visibility;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                onClick={() => choose(option.value)}
                className={`${menuItem} h-auto py-2`}
              >
                <VisibilityLabel option={option} />
                <Check
                  size={16}
                  strokeWidth={2.5}
                  aria-hidden
                  className={`shrink-0 transition duration-200 ease-out motion-reduce:transition-none ${
                    checked ? "scale-100 opacity-100" : "scale-50 opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** An option's icon, name and what it means. */
function VisibilityLabel({ option, labelId }: { option: (typeof VISIBILITY_OPTIONS)[number]; labelId?: string }) {
  const { label, description, icon: Icon } = option;
  return (
    <>
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-background">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span id={labelId} className="block text-sm font-medium">
          {label}
        </span>
        <span className="block text-xs font-normal text-muted">{description}</span>
      </span>
    </>
  );
}

/** The link, with a copy button whose icon turns into a check. */
function ShareLink({ projectId }: { projectId: string }) {
  const link = `${window.location.origin}/share/${projectId}`;
  return (
    <div className="flex h-10 items-center gap-1 rounded-xl bg-foreground/5 pr-1 pl-3">
      <p className="fade-end min-w-0 flex-1 text-sm text-muted">{link.replace(/^https?:\/\//, "")}</p>
      <CopyButton text={link} label="Copy link" />
    </div>
  );
}

/** The AI is building the first version: a little app drawing itself, like the preview's skeleton. */
function Building() {
  return (
    <div role="status" className="flex flex-col items-center px-3 pt-3 pb-4 text-center">
      <div aria-hidden className="w-full overflow-hidden rounded-xl border border-border bg-background">
        <div className="flex h-7 items-center gap-1.5 border-b border-border px-2.5">
          <Bone at={0} className="size-2.5 rounded-full" />
          <Bone at={1} className="h-1.5 w-10 rounded-full" />
          <Bone at={2} className="ml-auto h-1.5 w-6 rounded-full" />
        </div>
        <div className="flex flex-col items-center gap-1.5 px-4 pt-3.5 pb-3">
          <Bone at={3} className="h-2.5 w-2/3 rounded-full" />
          <Bone at={4} className="h-1.5 w-1/2 rounded-full" />
          <div className="mt-2 grid w-full grid-cols-2 gap-2">
            <Bone at={5} className="h-10 rounded-lg" />
            <Bone at={6} className="h-10 rounded-lg" />
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm font-medium">
        <span className="text-shimmer motion-safe:animate-shimmer">Building your app</span>
      </p>
      <p className="mt-1 text-xs text-balance text-muted">Your link will be ready once it&rsquo;s built.</p>
    </div>
  );
}

/** No app yet, and the AI isn't building one. */
function NothingToShare() {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-5 text-center">
      <AppWindow size={24} aria-hidden className="text-muted" />
      <p className="text-sm font-medium">Nothing to share yet</p>
      <p className="text-xs text-balance text-muted">Ask for an app, and you can share it here once it&rsquo;s built.</p>
    </div>
  );
}
