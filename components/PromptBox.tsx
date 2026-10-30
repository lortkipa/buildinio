"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, DragEvent, FormEvent, KeyboardEvent, RefObject } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Mic, Plus, Square } from "lucide-react";
import { toast } from "sonner";
import { AttachmentStrip } from "@/components/Attachments";
import { focusRing, shown, swap } from "@/components/styles";
import { Tooltip } from "@/components/Tooltip";
import { DOCK_CHROME, DOCK_GAP } from "@/components/useKeyboardDock";
import type { Dock } from "@/components/useKeyboardDock";
import { useAutocorrect } from "@/lib/account/store";
import { autoBullet, dropEmptyItems, listKey } from "@/lib/lists";
import type { Edit, ListKey } from "@/lib/lists";
import { attachmentUrl, isPicture, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS } from "@/lib/projects/attachments";
import { newId } from "@/lib/projects/ids";
import type { Attachment, Prompt } from "@/lib/projects/types";

const EXAMPLES = [
  "A booking app for my hair salon…",
  "A habit tracker that nudges me every morning…",
  "An online menu for my café…",
  "A client portal for my design studio…",
  "A shared gift list for my family…",
];

const TYPE_MS = 45;
const DELETE_MS = 20;
const HOLD_MS = 1800;
const NEXT_MS = 400;

/**
 * Types out example ideas one by one as the placeholder while `active`.
 * Pauses where it is when inactive and resumes from there.
 * Shows the first example without animating if the user prefers reduced motion.
 */
function useTypingPlaceholder(active: boolean) {
  const [text, setText] = useState(EXAMPLES[0]);
  // Start on a fully typed first example, so the loop begins by deleting it.
  const state = useRef({ index: 0, length: EXAMPLES[0].length, deleting: true });

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer: number;
    const tick = () => {
      const s = state.current;
      const full = EXAMPLES[s.index];
      let delay: number;

      if (s.deleting) {
        s.length -= 1;
        delay = DELETE_MS;
        if (s.length <= 0) {
          s.length = 0;
          s.deleting = false;
          s.index = (s.index + 1) % EXAMPLES.length;
          delay = NEXT_MS;
        }
      } else {
        s.length += 1;
        delay = TYPE_MS;
        if (s.length >= full.length) {
          s.length = full.length;
          s.deleting = true;
          delay = HOLD_MS;
        }
      }

      setText(EXAMPLES[s.index].slice(0, s.length));
      timer = window.setTimeout(tick, delay);
    };

    timer = window.setTimeout(tick, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  return text;
}

let editing = false; // While applyEdit types, so its own typing isn't taken for a new "- ".

/**
 * Puts a list edit in the text box the way typing would, so Undo takes it back:
 * only the part that changed is typed over. (execCommand is old, but it's the only
 * way into a text box's undo history.)
 */
function applyEdit(textarea: HTMLTextAreaElement, { value, start, end }: Edit) {
  const old = textarea.value;
  if (old !== value) {
    let from = 0;
    while (from < old.length && from < value.length && old[from] === value[from]) from++;
    let back = 0;
    while (back < old.length - from && back < value.length - from && old.at(-1 - back) === value.at(-1 - back)) back++;
    const text = value.slice(from, value.length - back);
    textarea.setSelectionRange(from, old.length - back);
    editing = true;
    try {
      const done = document.execCommand(text ? "insertText" : "delete", false, text);
      if (!done) {
        textarea.setRangeText(text, from, old.length - back);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } finally {
      editing = false;
    }
  }
  textarea.setSelectionRange(start, end);
  revealCaret(textarea);
}

/**
 * Scrolls a full text box to the cursor's line. Typing does that by itself; an edit
 * made in code doesn't, so a new item would hide under the bottom edge.
 */
function revealCaret(textarea: HTMLTextAreaElement) {
  if (textarea.scrollHeight <= textarea.clientHeight) return;
  // A copy of the box with only the text up to the cursor: its height is where the cursor's line ends.
  const probe = textarea.cloneNode() as HTMLTextAreaElement;
  probe.removeAttribute("id");
  probe.removeAttribute("name");
  probe.setAttribute("aria-hidden", "true");
  probe.value = textarea.value.slice(0, textarea.selectionEnd);
  Object.assign(probe.style, {
    position: "absolute",
    visibility: "hidden",
    width: `${textarea.offsetWidth}px`,
    height: "0",
    minHeight: "0",
    maxHeight: "none",
  });
  textarea.after(probe);
  const bottom = probe.scrollHeight;
  probe.remove();
  const line = parseFloat(getComputedStyle(textarea).lineHeight) || 24;
  if (bottom > textarea.scrollTop + textarea.clientHeight) textarea.scrollTop = bottom - textarea.clientHeight;
  else if (bottom - line * 1.5 < textarea.scrollTop) textarea.scrollTop = Math.max(0, bottom - line * 1.5);
}

/** The keys that do something special in a list. */
function listKeyOf(event: KeyboardEvent<HTMLTextAreaElement>): ListKey | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  // Shift+Enter too: it's how people make a new line, and in a list that's the next item.
  if (event.key === "Enter") return "Enter";
  if (event.key === "Tab") return event.shiftKey ? "Shift+Tab" : "Tab";
  if (event.key === "Backspace" && !event.shiftKey) return "Backspace";
  return null;
}

const iconButton = `grid size-9 cursor-pointer place-items-center rounded-full ${focusRing}`;

// Grows to 12 lines, then scrolls. lh is one line; 0.75rem is the textarea's pt-2 + pb-1.
const MAX_HEIGHT = "calc(12lh + 0.75rem)";
const STRIP_HEIGHT = 112; // The attached files' row (see AttachmentStrip), kept out of the text's height while docked.

/**
 * A file in the box. It uploads as soon as it's added (app/api/attachments), so sending
 * is quick: `id` is set once it's up. Pictures show from `preview` (made here) till then.
 */
type Draft = Omit<Attachment, "id"> & { key: string; id?: string; preview?: string; upload?: AbortController };

function forget(draft: Draft) {
  draft.upload?.abort();
  if (draft.preview) URL.revokeObjectURL(draft.preview);
}

/** Whether something being dragged is files (not text). */
function draggingFiles(event: DragEvent) {
  return event.dataTransfer.types.includes("Files");
}

const VARIANTS = {
  // On the home page: types out example ideas, with a glow behind.
  hero: { label: "Describe the app you want to build", placeholder: null, rows: 2 },
  // Under a project's chat: one line to start with.
  chat: { label: "Ask for changes", placeholder: "Ask for changes…", rows: 1 },
};

type PromptBoxProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  dock: Dock | null; // Set while the phone keyboard is open; see useKeyboardDock.
  onSubmit: (prompt: Prompt) => void;
  variant?: keyof typeof VARIANTS;
  busy?: boolean; // The AI is still answering: typing works, sending waits.
  onStop?: () => void; // Shows a Stop button instead of Send while busy.
  stopping?: boolean; // Stop was pressed and the answer is being undone.
  returned?: Prompt; // A stopped prompt to put back, if the box is empty. Then `onReturnedTaken`.
  onReturnedTaken?: () => void;
  signedIn?: boolean;
  className?: string;
};

export function PromptBox({
  textareaRef,
  dock,
  onSubmit,
  variant = "hero",
  busy = false,
  onStop,
  stopping = false,
  returned,
  onReturnedTaken,
  signedIn = false,
  className = "",
}: PromptBoxProps) {
  const router = useRouter();
  const id = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<Draft[]>([]);
  const [dragging, setDragging] = useState(false); // Files dragged over the box.
  const dragDepth = useRef(0); // Drag events come from each element inside too.
  const autocorrect = useAutocorrect(); // The user's setting: the browser's spell check and, on Apple devices, autocorrect.
  const { label, placeholder, rows } = VARIANTS[variant];
  const example = useTypingPlaceholder(!placeholder && value.length === 0);
  const prompt = dropEmptyItems(value).trim();
  const hasText = prompt.length > 0;
  const hasPrompt = hasText || files.length > 0; // Files alone can be sent too.
  const uploading = files.some((file) => !file.id);
  const canSend = hasPrompt && !busy && !uploading;
  const canStop = busy && onStop !== undefined;

  // Put the cursor in the box on desktop. Skipped on touch so the keyboard doesn't pop up.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) {
      textareaRef.current?.focus();
    }
  }, [textareaRef]);

  // A stopped prompt comes back to be changed and sent again, with its files, unless
  // something new is typed or attached.
  useEffect(() => {
    if (returned === undefined) return;
    const textarea = textareaRef.current;
    if (textarea && !textarea.value.trim() && files.length === 0) {
      const { text } = returned;
      setValue(text);
      setFiles(returned.attachments.map((file) => ({ ...file, key: file.id })));
      requestAnimationFrame(() => {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
        textarea.setSelectionRange(text.length, text.length);
        if (window.matchMedia("(pointer: fine)").matches) textarea.focus();
      });
    }
    onReturnedTaken?.();
  }, [returned, onReturnedTaken, textareaRef, files.length]);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setValue(event.target.value);
    // Grow with the text; max-height caps it at 12 lines and then it scrolls.
    const el = event.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    // "- " or "* " at the start of a line becomes a bullet: after React is done with
    // this change (still before the screen updates), or it puts the "-" back.
    const input = event.nativeEvent as InputEvent;
    if (!editing && input.inputType === "insertText" && input.data === " " && !input.isComposing) {
      queueMicrotask(() => {
        const edit = autoBullet(el.value, el.selectionStart);
        if (edit && el.selectionStart === el.selectionEnd) applyEdit(el, edit);
      });
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    const textarea = event.currentTarget;
    // Ctrl or Cmd+Enter always sends, even in a list or on a phone's keyboard.
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (canSend) textarea.form?.requestSubmit();
      return;
    }
    // In a list, Enter starts the next item, Tab moves it in a level, and so on.
    const key = listKeyOf(event);
    const edit = key && listKey(textarea.value, textarea.selectionStart, textarea.selectionEnd, key);
    if (edit) {
      event.preventDefault();
      applyEdit(textarea, edit);
      return;
    }
    // On phones Enter adds a new line; the send button is there to submit.
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) textarea.form?.requestSubmit();
    }
  }

  // Voice isn't there yet: signed-out people go to sign-up, signed-in ones hear it's coming.
  function notYet(what: string) {
    if (signedIn) toast.info(`${what} is coming soon.`);
    else router.push("/signup");
  }

  /** Picked, pasted or dropped: each file shows at once and uploads. Signed out, it's time to sign up. */
  function addFiles(list: FileList | File[]) {
    if (!signedIn) {
      router.push("/signup");
      return;
    }
    const picked = Array.from(list).filter((file) => {
      if (file.size > MAX_ATTACHMENT_BYTES) toast.error(`${file.name} is bigger than 10 MB.`);
      else if (file.size === 0) toast.error(`${file.name} is empty.`);
      else return true;
      return false;
    });
    const room = MAX_ATTACHMENTS - files.length;
    if (picked.length > room) toast.error(`You can attach up to ${MAX_ATTACHMENTS} files at once.`);
    const added = picked.slice(0, Math.max(0, room)).map((file) => {
      const draft: Draft = {
        key: newId(),
        name: file.name,
        type: file.type,
        size: file.size,
        preview: isPicture(file.type) ? URL.createObjectURL(file) : undefined,
        upload: new AbortController(),
      };
      upload(draft, file);
      return draft;
    });
    if (added.length) setFiles((current) => [...current, ...added]);
  }

  async function upload(draft: Draft, file: File) {
    const signal = draft.upload!.signal;
    const form = new FormData();
    form.append("file", file);
    let problem = `Couldn’t upload ${file.name}. Check your connection and try again.`;
    try {
      const response = await fetch("/api/attachments", { method: "POST", body: form, signal });
      if (response.ok) {
        const saved: Attachment = await response.json();
        // Removed while it uploaded: it's not wanted after all.
        if (signal.aborted) {
          fetch(`/api/attachments/${saved.id}`, { method: "DELETE" }).catch(() => {});
          return;
        }
        setFiles((current) =>
          current.map((d) => (d.key === draft.key ? { ...d, id: saved.id, name: saved.name, type: saved.type, upload: undefined } : d)),
        );
        return;
      }
      if (response.status < 500) problem = (await response.text()) || problem;
    } catch {
      if (signal.aborted) return;
    }
    forget(draft);
    setFiles((current) => current.filter((d) => d.key !== draft.key));
    toast.error(problem);
  }

  function removeFile(key: string) {
    const draft = files.find((file) => file.key === key);
    if (!draft) return;
    forget(draft);
    if (draft.id) fetch(`/api/attachments/${draft.id}`, { method: "DELETE" }).catch(() => {});
    setFiles((current) => current.filter((file) => file.key !== key));
  }

  // A picture copied, or a file copied from a folder, is attached rather than pasted as its name.
  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (event.clipboardData.files.length === 0) return;
    event.preventDefault();
    addFiles(event.clipboardData.files);
  }

  function handleDragEnter(event: DragEvent) {
    if (!draggingFiles(event)) return;
    event.preventDefault();
    dragDepth.current++;
    setDragging(true);
  }

  function handleDragOver(event: DragEvent) {
    if (!draggingFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event: DragEvent) {
    if (!draggingFiles(event)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function handleDrop(event: DragEvent) {
    if (!draggingFiles(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    onSubmit({ text: prompt, attachments: files.map(({ id, name, type, size }) => ({ id: id!, name, type, size })) });
    // Signed out, the prompt stays for when they come back from signing up.
    if (!signedIn) return;
    setValue("");
    files.forEach(forget); // Sent: the chat shows them from the server now.
    setFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "";
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative isolate w-full max-w-2xl ${className}`}
    >
      {/* Hidden while docked: the box has moved, so the glow would float on its own. */}
      {variant === "hero" && !dock && (
        <div
          aria-hidden
          className="bg-glow pointer-events-none absolute -inset-x-24 -inset-y-20 -z-10"
        />
      )}
      <div
        style={
          dock
            ? {
                position: "fixed",
                left: dock.boxLeft,
                width: dock.boxWidth,
                bottom: dock.keyboardInset + DOCK_GAP,
                zIndex: 50,
              }
            : undefined
        }
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-3xl border bg-surface text-left shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.12)] transition-[border-color,box-shadow] focus-within:shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_-12px_rgb(0_0_0/0.18)] ${
          dragging
            ? "border-foreground/40 ring-4 ring-foreground/5"
            : "border-border focus-within:border-foreground/20"
        }`}
      >
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        {/* Up to MAX_ATTACHMENTS files, over the text. */}
        {files.length > 0 && (
          <AttachmentStrip
            files={files.map((file) => ({
              ...file,
              src: file.preview ?? (file.id && isPicture(file.type) ? attachmentUrl(file.id) : undefined),
              uploading: !file.id,
            }))}
            onRemove={removeFile}
          />
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          aria-label="Files to attach"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = ""; // The same file can be picked again.
          }}
        />
        {/* Inset top-right so the scrollbar stays clear of the rounded corner. */}
        <div className="pt-2 pr-2">
          <textarea
            ref={textareaRef}
            id={id}
            name="prompt"
            rows={rows}
            enterKeyHint="enter"
            spellCheck={autocorrect}
            autoCorrect={autocorrect ? "on" : "off"}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder ?? example}
            style={{
              maxHeight: dock
                ? `min(${MAX_HEIGHT}, ${dock.visibleHeight - DOCK_CHROME - (files.length ? STRIP_HEIGHT : 0)}px)`
                : MAX_HEIGHT,
            }}
            className="scrollbar-thin block w-full resize-none bg-transparent pt-2 pr-3 pb-1 pl-5 text-base leading-relaxed text-foreground outline-none placeholder:text-muted"
          />
        </div>

        {/* preventDefault keeps focus in the text box, so tapping a button
            doesn't close the phone keyboard. */}
        <div
          onMouseDown={(event) => event.preventDefault()}
          className="flex items-center justify-between px-3 pb-3"
        >
          {/* Signed out, it goes to sign-up (see addFiles). */}
          <Tooltip label="Add files" side="top">
            <button
              type="button"
              aria-label="Add files"
              onClick={() => (signedIn ? fileInputRef.current?.click() : router.push("/signup"))}
              className={`${iconButton} text-muted transition-colors hover:bg-foreground/5 hover:text-foreground`}
            >
              <Plus size={20} />
            </button>
          </Tooltip>

          {/* Mic and submit share one spot and swap when there's text or a file. While
              the AI answers, Stop takes it. */}
          <div className="grid">
            <Tooltip label="Voice input" side="top">
              <button
                type="button"
                aria-label="Use voice input"
                inert={hasPrompt || canStop}
                onClick={() => notYet("Voice input")}
                className={`${iconButton} ${swap} text-muted hover:bg-foreground/5 hover:text-foreground ${
                  hasPrompt || canStop ? "scale-50 -rotate-45 opacity-0" : shown
                }`}
              >
                <Mic size={20} />
              </button>
            </Tooltip>
            <Tooltip
              label={
                busy
                  ? "Wait for the answer to finish"
                  : uploading
                    ? "Wait for the files to upload"
                    : variant === "hero"
                      ? "Start building"
                      : "Send"
              }
              keys={busy || uploading ? undefined : ["↵"]}
              side="top"
            >
              <button
                type="submit"
                aria-label={variant === "hero" ? "Start building" : "Send"}
                inert={!hasPrompt || canStop}
                disabled={busy || uploading}
                className={`${iconButton} ${swap} bg-foreground text-background enabled:hover:bg-foreground/85 disabled:cursor-not-allowed ${
                  !hasPrompt || canStop
                    ? "scale-50 rotate-45 opacity-0"
                    : busy || uploading
                      ? "scale-100 rotate-0 opacity-30"
                      : shown
                }`}
              >
                <ArrowUp size={18} strokeWidth={2.25} />
              </button>
            </Tooltip>
            <Tooltip label="Stop and undo this answer" side="top">
              <button
                type="button"
                aria-label="Stop"
                inert={!canStop}
                disabled={stopping}
                onClick={onStop}
                className={`${iconButton} ${swap} bg-error text-background enabled:hover:bg-error/85 disabled:cursor-default ${
                  !canStop ? "scale-50 opacity-0" : stopping ? "scale-100 opacity-30" : shown
                }`}
              >
                <Square size={12} fill="currentColor" strokeWidth={0} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </form>
  );
}
