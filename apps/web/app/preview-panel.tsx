"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ICON_BUTTON } from "./icon-button";
import { ExternalLinkIcon, MonitorIcon, SmartphoneIcon, TabletIcon } from "./icons";
import { mockPreviewDocument } from "./mock-preview";
import type { Project } from "./projects";
import { revealForm } from "./reveal-form";
import { useLarge, useWide } from "./wide";

type Device = "desktop" | "tablet" | "mobile";

// Desktop fills the panel. Tablet and mobile are laid out at their width, scaled down when the panel
// is narrower.
const DEVICES = {
  desktop: { name: "Desktop", width: null, Icon: MonitorIcon },
  tablet: { name: "Tablet", width: 768, Icon: TabletIcon },
  mobile: { name: "Mobile", width: 390, Icon: SmartphoneIcon },
} as const satisfies Record<
  Device,
  { name: string; width: number | null; Icon: typeof MonitorIcon }
>;

// What the device button goes through, in order, by screen: a desktop can preview on all three, a
// tablet on the two that aren't bigger than it. A phone has no device button: the preview fills it.
const DESKTOP_DEVICES: Device[] = ["desktop", "tablet", "mobile"];
const TABLET_DEVICES: Device[] = ["tablet", "mobile"];

// How long the frame takes to change width after a device is picked.
const SWITCH_MS = 300;

/*
 * What the route field makes of what was typed: a path from the root, e.g. "about/" → "/about". A
 * whole address pasted in keeps only its path, query and hash.
 */
export function normalizeRoute(input: string) {
  const path = input.trim().replace(/^[a-z][a-z\d+.-]*:\/\/[^/?#]*/i, "");
  const end = path.search(/[?#]/);
  const pathname = end === -1 ? path : path.slice(0, end);
  const rest = end === -1 ? "" : path.slice(end);
  return `/${pathname}`.replace(/\/{2,}/g, "/").replace(/(.)\/+$/, "$1") + rest;
}

/*
 * The app the project builds, beside its chat from md up and in its place on phones
 * (ProjectWorkspace). A toolbar, on top from md up and at the bottom on phones: the device to
 * preview on (not on phones, where the preview fills the screen), the page the app is on (which can be typed over to go to another), and opening the app
 * in a tab of its own. Under it, the app in a sandboxed iframe: the mock app (mock-preview.ts),
 * or a shimmer until the AI's first reply. dragging: the panel is being resized, so the iframe
 * mustn't catch the pointer.
 */
export function PreviewPanel({ project, dragging }: { project: Project; dragging: boolean }) {
  const id = useId();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Focus just selected the route, so the click's mouseup mustn't place the caret instead.
  const justFocused = useRef(false);
  const wide = useWide();
  const large = useLarge();
  // The device picked. A screen without it among its devices shows the first of them instead.
  const [picked, setPicked] = useState<Device>("desktop");
  // A device was picked: the icon pops in, and the frame's width animates for a moment.
  const [changed, setChanged] = useState(false);
  const [switching, setSwitching] = useState(false);
  // The page the app reports it is on, and what's typed in the field while it has focus.
  const [route, setRoute] = useState("/");
  const [draft, setDraft] = useState<string | null>(null);
  const routeRef = useRef(route);
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);

  const name = project.name ?? "";
  const prompt = project.messages.find((message) => message.role === "user")?.text ?? "";
  // Until the first reply, the app is still being built.
  const building = !project.messages.some((message) => message.role === "ai");

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  // Rebuilt when the app changes (a rename or a new color), opening on the page it was on.
  const appDocument = useMemo(
    () =>
      building
        ? null
        : mockPreviewDocument({
            name,
            color: project.color,
            tagline: prompt,
            route: routeRef.current,
          }),
    [building, name, project.color, prompt],
  );

  // The app tells which page it is on. Only this frame's messages count.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data: unknown = event.data;
      if (
        typeof data === "object" &&
        data !== null &&
        "type" in data &&
        data.type === "route" &&
        "path" in data &&
        typeof data.path === "string"
      )
        setRoute(data.path);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // The frame's size, to scale the tablet and mobile views into.
  useEffect(() => {
    const box = areaRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setArea({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // Keep the route field above the phone keyboard (see revealForm).
  useEffect(() => {
    const onResize = () => {
      const input = inputRef.current;
      if (input?.form && document.activeElement === input) revealForm(input.form);
    };
    window.visualViewport?.addEventListener("resize", onResize);
    return () => window.visualViewport?.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!switching) return;
    const timer = setTimeout(() => setSwitching(false), SWITCH_MS);
    return () => clearTimeout(timer);
  }, [switching]);

  const devices = large ? DESKTOP_DEVICES : TABLET_DEVICES;
  const device: Device = !wide
    ? "desktop"
    : devices.includes(picked)
      ? picked
      : (devices[0] ?? "desktop");
  const nextDevice = devices[(devices.indexOf(device) + 1) % devices.length] ?? device;

  function pickNextDevice() {
    setPicked(nextDevice);
    setChanged(true);
    setSwitching(true);
  }

  // The opaque origin of a sandboxed frame can only be addressed as "*".
  function navigate(path: string) {
    iframeRef.current?.contentWindow?.postMessage({ type: "navigate", path }, "*");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(normalizeRoute(draft ?? route));
    inputRef.current?.blur();
  }

  const current = DEVICES[device];
  const scale = current.width && area ? Math.min(1, area.width / current.width) : 1;

  return (
    // From md up, it keeps its width while the panel slides shut, unless the window is too narrow
    // for that (cqw: the workspace's width).
    <div className="flex size-full flex-col md:min-w-[min(22.5rem,50cqw)]">
      {/* Level with the chat's top bar from md up; above the home indicator on phones. */}
      <div className="flex shrink-0 justify-center p-3 max-md:order-last max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex w-full max-w-lg items-center gap-1">
          <button
            type="button"
            onClick={pickNextDevice}
            aria-label={`${current.name} view. Switch to ${DEVICES[nextDevice].name.toLowerCase()}`}
            title={`${current.name} view`}
            // Not on phones: the preview fills the screen.
            className={`${ICON_BUTTON} shrink-0 max-md:hidden`}
          >
            <current.Icon
              key={device}
              className={`size-5 ${changed ? "animate-icon-in motion-reduce:animate-none" : ""}`}
            />
          </button>

          <form onSubmit={handleSubmit} className="min-w-0 flex-1 scroll-my-4">
            <label htmlFor={id} className="sr-only">
              Page address
            </label>
            {/* 16px on phones, or iOS zooms in on focus. */}
            <input
              ref={inputRef}
              id={id}
              type="text"
              inputMode="url"
              enterKeyHint="go"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={building}
              value={draft ?? route}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={(event) => {
                setDraft(route);
                event.currentTarget.select();
                justFocused.current = true;
              }}
              onMouseUp={(event) => {
                if (justFocused.current) event.preventDefault();
                justFocused.current = false;
              }}
              onKeyDown={(event) => {
                justFocused.current = false;
                if (event.key === "Escape") event.currentTarget.blur();
              }}
              onBlur={() => {
                justFocused.current = false;
                setDraft(null);
              }}
              className="h-10 w-full rounded-xl border border-zinc-950/10 bg-white/70 px-3.5 text-base text-zinc-700 transition-colors outline-none focus:border-brand-violet/60 focus:bg-white focus:text-zinc-950 disabled:opacity-60 md:text-sm dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-300 dark:focus:bg-zinc-900 dark:focus:text-white"
            />
          </form>

          {/* Not built yet: will open the app on its own, without the chat and the sidebar. */}
          <button
            type="button"
            aria-label="Open in a new tab"
            title="Open in a new tab"
            className={`${ICON_BUTTON} shrink-0`}
          >
            <ExternalLinkIcon className="size-4.5" />
          </button>
        </div>
      </div>

      <div
        ref={areaRef}
        className="flex min-h-0 flex-1 justify-center px-3 pb-3 max-md:pt-3 max-md:pb-0"
      >
        <div
          style={{ width: current.width ? current.width * scale : "100%" }}
          className={`h-full max-w-full overflow-hidden rounded-xl border border-zinc-950/10 bg-white shadow-lg shadow-zinc-950/5 dark:border-white/10 dark:bg-zinc-950 dark:shadow-black/30 ${
            switching
              ? "transition-[width] duration-300 ease-out motion-reduce:transition-none"
              : ""
          }`}
        >
          {appDocument === null ? (
            <Building />
          ) : (
            <iframe
              ref={iframeRef}
              title={`Preview of ${name}`}
              srcDoc={appDocument}
              sandbox="allow-scripts"
              style={
                current.width
                  ? {
                      width: current.width,
                      height: area ? area.height / scale : "100%",
                      transform: scale < 1 ? `scale(${scale})` : undefined,
                      transformOrigin: "top left",
                    }
                  : undefined
              }
              className={`block border-0 ${current.width ? "" : "size-full"} ${dragging ? "pointer-events-none" : ""}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// A page-shaped shimmer while the AI builds the first version.
function Building() {
  return (
    <div role="status" className="flex size-full flex-col gap-4 overflow-hidden p-6">
      <div className="flex items-center justify-between gap-4">
        <span className="h-7 w-28 skeleton rounded-full" />
        <span className="h-4 w-36 skeleton rounded-full" />
      </div>
      <span className="mt-10 h-10 w-3/4 skeleton rounded-xl" />
      <span className="h-4 w-1/2 skeleton rounded-full" />
      <div className="mt-6 grid grid-cols-3 gap-3">
        <span className="h-28 skeleton rounded-2xl" />
        <span className="h-28 skeleton rounded-2xl" />
        <span className="h-28 skeleton rounded-2xl" />
      </div>
      <p className="mt-auto text-center text-sm text-zinc-500 dark:text-zinc-400">
        Building your app…
      </p>
    </div>
  );
}
