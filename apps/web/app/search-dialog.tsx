"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Dialog } from "./dialog";
import { ICON_BUTTON } from "./icon-button";
import { SearchIcon, XIcon } from "./icons";
import { ProjectIcon, projectColorStyle } from "./project-icon";
import { useProjects } from "./projects";
import { useScrollFade } from "./scroll-fade";
import { type Range, type SearchResult, searchProjects } from "./search";

/*
 * Search, over the page: a field and the projects matching it, by name or by what was said in their
 * chats (search.ts). Without a query, all projects, newest first. The arrows move through the
 * results and Enter opens one, as does a click. AppShell renders it once, beside the phone sheet, so
 * it opens above it; onNavigate closes the sheet too.
 *
 * session: a new number each time it opens, for a fresh, empty search.
 */
export function SearchDialog({
  open,
  session,
  onClose,
  onNavigate,
}: {
  open: boolean;
  session: number;
  onClose: () => void;
  onNavigate: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      // A fixed height, so it doesn't jump as results come and go. Shorter while a phone keyboard is up.
      className="h-[min(calc(100dvh-var(--keyboard-inset,0px)-2rem),34rem)] w-[min(calc(100%-2rem),36rem)]"
    >
      <SearchPanel
        key={session}
        titleId={titleId}
        onClose={onClose}
        onNavigate={() => {
          onClose();
          onNavigate();
        }}
      />
    </Dialog>
  );
}

function SearchPanel({
  titleId,
  onClose,
  onNavigate,
}: {
  titleId: string;
  onClose: () => void;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const fieldId = useId();
  const listId = useId();
  const projects = useProjects();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  // Set when the keyboard moves the active result, which then scrolls into view. A hover doesn't.
  const scrollToActive = useRef(false);
  useScrollFade(listRef);

  const results = useMemo(() => searchProjects(projects, query), [projects, query]);
  // The list can shrink under it, e.g. when a project is deleted.
  const activeIndex = Math.min(active, results.length - 1);
  const activeResult = results[activeIndex];
  const optionId = (result: SearchResult) => `${listId}-${result.project.id}`;
  const searching = query.trim() !== "";

  useEffect(() => {
    if (!scrollToActive.current || !activeResult) return;
    scrollToActive.current = false;
    document
      .getElementById(`${listId}-${activeResult.project.id}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeResult, listId]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      scrollToActive.current = true;
      setActive((activeIndex + step + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!activeResult) return;
      router.push(`/projects/${activeResult.project.id}`);
      onNavigate();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <h2 id={titleId} className="sr-only">
        Search
      </h2>
      <div className="flex items-center gap-2 border-b border-zinc-950/10 py-2 pr-2 pl-4 dark:border-white/10">
        <SearchIcon className="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
        <label htmlFor={fieldId} className="sr-only">
          Search projects and chats
        </label>
        {/* text-base: iOS zooms into fields with smaller text. Not type="search": in Chrome, Escape
            would clear it instead of closing the dialog. */}
        <input
          id={fieldId}
          data-autofocus
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeResult ? optionId(activeResult) : undefined}
          autoComplete="off"
          enterKeyHint="search"
          spellCheck={false}
          placeholder="Search projects and chats"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            listRef.current?.scrollTo({ top: 0 });
          }}
          onKeyDown={handleKeyDown}
          className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
        />
        <button type="button" onClick={onClose} aria-label="Close search" className={ICON_BUTTON}>
          <XIcon className="size-5" />
        </button>
      </div>

      <div
        ref={listRef}
        className="prompt-scrollbar scroll-fade-edges min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
      >
        {/* One element that is always there, which useScrollFade watches as results change. */}
        <div>
          {results.length === 0 ? (
            <p className="px-2.5 py-8 text-center text-sm text-pretty wrap-anywhere text-zinc-600 dark:text-zinc-300">
              {searching
                ? `No projects or chats match “${query.trim()}”.`
                : "No projects yet. Start one from New."}
            </p>
          ) : (
            <>
              <p className="px-2.5 pt-1 pb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {searching ? "Results" : "Recent"}
              </p>
              <div
                id={listId}
                role="listbox"
                aria-label="Projects"
                className="flex flex-col gap-0.5"
              >
                {results.map((result, index) => (
                  <ResultItem
                    key={result.project.id}
                    id={optionId(result)}
                    result={result}
                    active={index === activeIndex}
                    onHover={() => setActive(index)}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/*
 * A project: its icon and name, or a shimmer while the AI is naming it, and when only a message
 * matched, a line of that message, the match highlighted in the project's color.
 */
function ResultItem({
  id,
  result,
  active,
  onHover,
  onNavigate,
}: {
  id: string;
  result: SearchResult;
  active: boolean;
  onHover: () => void;
  onNavigate: () => void;
}) {
  const { project, snippet } = result;

  return (
    <Link
      id={id}
      href={`/projects/${project.id}`}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onClick={onNavigate}
      // Not mouseenter: the list scrolling under a still pointer would change the active result.
      onPointerMove={active ? undefined : onHover}
      style={projectColorStyle(project.color)}
      className="flex min-h-12 items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-zinc-700 aria-selected:bg-zinc-950/5 aria-selected:text-zinc-950 dark:text-zinc-300 dark:aria-selected:bg-white/10 dark:aria-selected:text-white"
    >
      {project.name === null ? (
        <span aria-hidden className="size-8 shrink-0 skeleton rounded-lg" />
      ) : (
        <ProjectIcon
          icon={project.icon}
          color={project.color}
          className="size-8 rounded-lg"
          glyphClassName="size-4"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {project.name === null ? (
          <>
            <span aria-hidden className="my-1 h-3 w-28 skeleton rounded-full" />
            <span className="sr-only">Naming your project…</span>
          </>
        ) : (
          <span className="truncate-fade font-medium">{project.name}</span>
        )}
        {snippet && (
          <span className="truncate-fade text-xs text-zinc-500 dark:text-zinc-400">
            {snippet.role === "user" ? "You: " : "Buildinio: "}
            <Highlight text={snippet.text} range={snippet.match} />
          </span>
        )}
      </span>
    </Link>
  );
}

function Highlight({ text, range }: { text: string; range?: Range }) {
  if (!range) return text;
  return (
    <>
      {text.slice(0, range[0])}
      <mark className="rounded-[0.25rem] project-tint text-zinc-950 dark:text-white">
        {text.slice(range[0], range[1])}
      </mark>
      {text.slice(range[1])}
    </>
  );
}
