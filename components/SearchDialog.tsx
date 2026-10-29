"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Ellipsis, Search, X } from "lucide-react";
import { Highlight } from "@/components/Highlight";
import type { ProjectMenuAnchor } from "@/components/ProjectActions";
import { ProjectLabel, ProjectTile } from "@/components/ProjectTile";
import { focusRing, rowOptions, rowOptionsOnHover } from "@/components/styles";
import { useCloseOnBackdrop } from "@/components/useCloseOnBackdrop";
import { useMenuPress } from "@/components/useMenuPress";
import { useProjectMenu } from "@/components/useProjectMenu";
import { useScrollEdges } from "@/components/useScrollEdges";
import { searchProjects, searchWords } from "@/lib/projects/search";
import type { SearchResult } from "@/lib/projects/search";
import { useProjects } from "@/lib/projects/store";

const closeButton = `grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-foreground/5 hover:text-foreground ${focusRing}`;

type SearchDialogProps = {
  onClose: () => void; // Closed without opening a project.
  onNavigate: () => void; // A project was opened, or the open one deleted.
};

/**
 * Finds projects by their name or by what was said in their chats, as you type.
 * Opens when it mounts. Like the settings, a pop-up over everything.
 */
export function SearchDialog({ onClose, onNavigate }: SearchDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const backdrop = useCloseOnBackdrop(ref);
  const pathname = usePathname();
  const router = useRouter();
  const { loaded, projects } = useProjects();
  const menu = useProjectMenu(onNavigate);
  const [query, setQuery] = useState("");
  const words = useMemo(() => searchWords(query), [query]);
  const results = useMemo(() => searchProjects(projects, words), [projects, words]);
  useScrollEdges(scrollRef);

  useEffect(() => {
    ref.current?.showModal();
    inputRef.current?.focus();
  }, []);

  // Back to the top of the results as the search changes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [words]);

  // Enter opens the first project found.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const first = results[0]?.project;
    if (!first) return;
    onNavigate();
    router.push(`/projects/${first.id}`);
  }

  // Up and down move between the search box and the projects.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.key !== "ArrowDown" && event.key !== "ArrowUp") || event.defaultPrevented) return;
    const stops = [inputRef.current, ...(listRef.current?.querySelectorAll("a") ?? [])];
    const at = stops.indexOf(
      // From a ⋯ button, as if from its project.
      (document.activeElement?.closest("li")?.querySelector("a") ?? document.activeElement) as HTMLAnchorElement,
    );
    const next = Math.min(Math.max(at + (event.key === "ArrowDown" ? 1 : -1), 0), stops.length - 1);
    if (at === -1 || next === at) return;
    event.preventDefault();
    stops[next]?.focus();
  }

  return (
    <dialog
      ref={ref}
      aria-label="Search"
      // React passes these on from the dialogs inside too: only this one's count.
      onClose={(event) => event.target === event.currentTarget && onClose()}
      {...backdrop}
      // At the top on phones, clear of the keyboard; in the middle on wider screens.
      className="mx-auto mt-2 mb-auto h-[min(34rem,calc(100dvh-1rem))] w-[calc(100%-1rem)] max-w-2xl overflow-hidden rounded-3xl border border-border bg-surface p-0 text-left text-foreground shadow-[0_24px_64px_-16px_rgb(0_0_0/0.35)] outline-none backdrop:bg-black/40 open:motion-safe:animate-pop sm:m-auto sm:h-[min(32rem,calc(100dvh-2rem))] sm:w-[calc(100%-2rem)]"
    >
      <div className="flex h-full flex-col" onKeyDown={handleKeyDown}>
        <form role="search" onSubmit={handleSubmit} className="flex h-16 shrink-0 items-center gap-3 border-b border-border pr-3.5 pl-5">
          <Search aria-hidden size={20} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            type="text"
            aria-label="Search projects and chats"
            aria-controls={`${id}-results`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects and chats"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted"
          />
          <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className={closeButton}>
            <X size={18} />
          </button>
        </form>

        <div id={`${id}-results`} ref={scrollRef} className="scrollbar-thin fade-y min-h-0 flex-1 overflow-y-auto p-2">
          {loaded &&
            (results.length > 0 ? (
              <ul ref={listRef} aria-label="Projects" className="flex flex-col gap-0.5">
                {results.map((result) => (
                  <SearchRow
                    key={result.project.id}
                    result={result}
                    words={words}
                    current={pathname === `/projects/${result.project.id}`}
                    menuOpen={menu.openId === result.project.id}
                    onMenu={(anchor, trigger) => menu.openMenu(result.project, anchor, trigger)}
                    onNavigate={onNavigate}
                  />
                ))}
              </ul>
            ) : (
              <p className="px-6 pt-10 text-center text-sm text-balance text-muted">
                {projects.length === 0 ? (
                  "Your apps will show up here."
                ) : (
                  <>
                    Nothing matches &ldquo;<span className="wrap-anywhere text-foreground">{query.trim()}</span>&rdquo;.
                  </>
                )}
              </p>
            ))}
        </div>

        <p role="status" className="sr-only">
          {loaded && words.length > 0 && `${results.length} ${results.length === 1 ? "project" : "projects"} found`}
        </p>
      </div>

      {menu.dialogs}
    </dialog>
  );
}

type SearchRowProps = {
  result: SearchResult;
  words: string[];
  current: boolean;
  menuOpen: boolean;
  onMenu: (anchor: ProjectMenuAnchor, trigger: HTMLElement | null) => void;
  onNavigate: () => void;
};

/**
 * A project found: its tile and name, and under them where its chat matched (if it was
 * found there). Opens it. The options button, top right, works like the sidebar's.
 */
function SearchRow({ result: { project, snippet }, words, current, menuOpen, onMenu, onNavigate }: SearchRowProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { openFromButton, handlers } = useMenuPress(buttonRef, onMenu, onNavigate);
  const naming = project.name === null && project.turn !== null;

  return (
    <li className="group/row relative">
      <Link
        href={`/projects/${project.id}`}
        aria-current={current ? "page" : undefined}
        draggable={false}
        {...handlers}
        // No text selection or link preview when holding a finger on it. The text only
        // makes room for the options button while it shows.
        className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl py-2.5 pl-3 text-left select-none [-webkit-touch-callout:none] transition-colors hover:bg-foreground/5 aria-[current=page]:bg-foreground/5 ${focusRing} ${
          menuOpen ? "pr-12" : "pr-12 pointer-fine:pr-3 pointer-fine:group-focus-within/row:pr-12 pointer-fine:group-hover/row:pr-12"
        }`}
      >
        {naming ? (
          <span className="skeleton size-9 shrink-0 rounded-xl motion-safe:animate-shimmer" />
        ) : (
          <ProjectTile icon={project.icon} color={project.color} className="size-9 rounded-xl" iconSize={18} />
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex h-5 min-w-0 items-center text-sm font-medium">
            <ProjectLabel project={project} tile={false} highlight={words} className="flex-1" />
          </span>
          {snippet && (
            <span className="fade-end text-sm text-muted">
              <Highlight text={snippet} words={words} />
            </span>
          )}
        </span>
      </Link>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Options for ${project.name ?? "new project"}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={openFromButton}
        className={`absolute right-2 ${snippet ? "top-1" : "top-1/2 -translate-y-1/2"} ${rowOptions} ${rowOptionsOnHover}`}
      >
        <Ellipsis size={16} />
      </button>
    </li>
  );
}
