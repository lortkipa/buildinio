"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "./icons";
import { MENU_SURFACE } from "./menu";
import { FIELD } from "./settings-parts";

export type SelectOption = { value: string; label: string; lang?: string };

// Between the field and its list, and the closest the list comes to the edges of the screen.
const GAP = 6;
const EDGE = 8;
// The tallest the list gets, scrolling beyond it.
const MAX_HEIGHT = 320;

/*
 * A field that picks one of a few options from a list under it (above it with less room below),
 * styled like the menus rather than the browser's own select. The list is a popover, drawn above
 * everything at a fixed position, so a dialog doesn't clip it; it closes when the window resizes or
 * something around it scrolls, rather than float away from the field. Arrow keys, Home and End move
 * through the options, typing jumps to one starting with those letters, and Enter or Space picks.
 */
export function Select({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const typed = useRef({ text: "", at: 0 });
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = () => listRef.current?.hidePopover();
    const scroll = (event: Event) => {
      if (!listRef.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", scroll, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [open]);

  const place = (list: HTMLElement) => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const { clientHeight } = document.documentElement;
    const below = clientHeight - rect.bottom - GAP - EDGE;
    const above = rect.top - GAP - EDGE;
    const { style } = list;
    style.left = `${rect.left}px`;
    style.width = `${rect.width}px`;
    if (below >= Math.min(MAX_HEIGHT, list.scrollHeight) || below >= above) {
      style.top = `${rect.bottom + GAP}px`;
      style.bottom = "auto";
      style.maxHeight = `${Math.min(MAX_HEIGHT, below)}px`;
      style.transformOrigin = "top";
    } else {
      style.top = "auto";
      style.bottom = `${clientHeight - rect.top + GAP}px`;
      style.maxHeight = `${Math.min(MAX_HEIGHT, above)}px`;
      style.transformOrigin = "bottom";
    }
  };

  const items = () => [
    ...(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []),
  ];
  const focusItem = (item: HTMLElement | undefined) => item?.focus();

  const pick = (next: string) => {
    onChange(next);
    listRef.current?.hidePopover();
  };

  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const all = items();
    const index = all.indexOf(document.activeElement as HTMLElement);
    let next: number | undefined;
    if (event.key === "ArrowDown") next = Math.min(index + 1, all.length - 1);
    else if (event.key === "ArrowUp") next = Math.max(index - 1, 0);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = all.length - 1;
    else if (event.key === "Tab") listRef.current?.hidePopover();
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && event.key !== " ") {
      // Typing jumps to the next option starting with what was typed in the last half second.
      const now = Date.now();
      const text = (now - typed.current.at < 500 ? typed.current.text : "") + event.key;
      typed.current = { text, at: now };
      const start = text.length === 1 ? index + 1 : index;
      const match = [...all.slice(start), ...all.slice(0, start)].find((item) =>
        item.textContent?.toLocaleLowerCase().startsWith(text.toLocaleLowerCase()),
      );
      if (match) focusItem(match);
      return;
    }
    if (next === undefined) return;
    event.preventDefault();
    focusItem(all[next]);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        popoverTarget={`${id}-list`}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            listRef.current?.showPopover();
          }
        }}
        className={`${FIELD} flex cursor-pointer items-center pr-11 text-left focus-visible:border-brand-violet aria-expanded:border-brand-violet`}
      >
        <span lang={selected?.lang} className="truncate">
          {selected?.label}
        </span>
      </button>
      <ChevronDownIcon
        className={`pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-zinc-500 transition-transform duration-200 dark:text-zinc-400 ${open ? "rotate-180" : ""}`}
      />

      <div
        ref={listRef}
        id={`${id}-list`}
        popover="auto"
        role="listbox"
        aria-label={label}
        onBeforeToggle={(event) => {
          if (event.newState === "open") place(event.currentTarget);
        }}
        onToggle={(event) => {
          const isOpen = event.newState === "open";
          setOpen(isOpen);
          if (isOpen) {
            const all = items();
            focusItem(all.find((item) => item.getAttribute("aria-selected") === "true") ?? all[0]);
          }
        }}
        onKeyDown={onListKeyDown}
        className={`${MENU_SURFACE} prompt-scrollbar overflow-y-auto overscroll-contain`}
      >
        {options.map((option) => {
          const isSelected = option.value === selected?.value;
          return (
            <div
              key={option.value}
              role="option"
              tabIndex={-1}
              lang={option.lang}
              aria-selected={isSelected}
              onClick={() => pick(option.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  pick(option.value);
                }
              }}
              // Hovering moves focus, so the keyboard carries on from where the mouse is.
              onPointerMove={(event) => {
                if (event.pointerType === "mouse" && document.activeElement !== event.currentTarget)
                  event.currentTarget.focus({ preventScroll: true });
              }}
              className="flex h-9 cursor-pointer scroll-my-1.5 items-center gap-3 rounded-lg px-2.5 text-zinc-700 outline-none transition-colors focus:bg-zinc-950/5 focus:text-zinc-950 aria-selected:font-medium aria-selected:text-zinc-950 dark:text-zinc-300 dark:focus:bg-white/10 dark:focus:text-white dark:aria-selected:text-white"
            >
              <span className="flex-1 truncate">{option.label}</span>
              {isSelected && <CheckIcon className="size-4 shrink-0 text-brand-violet" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
