"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { AttachmentTile } from "./attachment-tile";
import { ACCEPT, type Attachment, attachFiles, revokeAttachments } from "./attachments";
import { FileDrop } from "./file-drop";
import { ArrowUpIcon, MicIcon, PlusIcon } from "./icons";
import { ImageViewer } from "./image-viewer";
import { hasFinePointer } from "./pointer";
import { revealForm, VIEWPORT_GAP } from "./reveal-form";
import { useScrollFade } from "./scroll-fade";
import { Toast, useToast } from "./toast";

// Shown one after another as the placeholder. Keep them frontend-only (Phase 1).
const EXAMPLES = [
  "A habit tracker with daily streaks and a calendar view",
  "A landing page for my coffee shop with the menu and opening hours",
  "A recipe box where I can save and search my favorite meals",
  "A flashcard app to help me learn Spanish",
  "A portfolio site to show off my photography",
  "A workout timer with custom intervals and rest breaks",
  "A budget planner that shows where my money goes each month",
  "A trip planner with a day-by-day plan and a packing list",
];

// Grow with the content up to the max height (see fitTextarea), after which it scrolls.
function autosize(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

// One line (text-base/6) plus the textarea's pt-3 and pb-2.
const MIN_TEXTAREA_HEIGHT = 44;

// Cap the textarea so the form fits in the visible area (see revealForm), then fit the textarea
// to its content.
function fitTextarea(textarea: HTMLTextAreaElement) {
  const viewport = window.visualViewport;
  const form = textarea.form;
  // Pinch zoom shrinks the visual viewport too; keep the last cap while zoomed.
  if (viewport && form && viewport.scale === 1) {
    const room = viewport.height - (form.offsetHeight - textarea.offsetHeight) - 2 * VIEWPORT_GAP;
    // 15rem is max-h-60, the cap before this runs and on roomy screens.
    textarea.style.maxHeight = `min(15rem, ${Math.max(room, MIN_TEXTAREA_HEIGHT)}px)`;
  }
  autosize(textarea);
}

/*
 * nextStep: where sending the prompt and every button lead, e.g. signing up first. onSend: gets the
 * prompt and the attached files instead, and the box empties; the plus attaches files (see
 * attachments.ts), as does dropping them anywhere on the page, shown as tiles above the text, and
 * files alone can be sent too. Without either,
 * they do nothing yet. placeholder: shown instead of the cycling examples. busy: the prompt can't be
 * sent yet, e.g. while the AI replies.
 */
export function PromptInput({
  nextStep,
  onSend,
  placeholder,
  busy = false,
}: {
  nextStep?: string;
  onSend?: (prompt: string, attachments: Attachment[]) => void;
  placeholder?: string;
  busy?: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [exampleIndex, setExampleIndex] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [viewing, setViewing] = useState<Attachment | null>(null);
  const { toast, showToast, closeToast } = useToast();
  const hasText = value.trim() !== "";
  const canSend = hasText || attachments.length > 0;
  // The files not sent yet, freed if the box goes away with them. Sent ones belong to the message.
  const unsent = useRef<Attachment[]>([]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    // Let desktop users type right away; on phones this would pop up the keyboard.
    if (hasFinePointer()) textarea.focus();
    // The visual viewport resizes when the keyboard opens or closes, and on any window resize
    // (a new width changes the line wrapping, and with it the height).
    const onResize = () => {
      fitTextarea(textarea);
      if (document.activeElement === textarea && textarea.form) revealForm(textarea.form);
    };
    window.visualViewport?.addEventListener("resize", onResize);
    return () => window.visualViewport?.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    unsent.current = attachments;
  }, [attachments]);

  useEffect(() => () => revokeAttachments(unsent.current), []);

  // The row of files above the text changes the form's height, and with it the room for the text.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when files come or go
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) fitTextarea(textarea);
  }, [attachments.length]);

  // Every button and sending the prompt lead to the next step, so have it ready.
  useEffect(() => {
    if (nextStep) router.prefetch(nextStep);
  }, [router, nextStep]);

  function goNext() {
    if (nextStep) router.push(nextStep);
  }

  // Back to the text after picking or removing files, on desktops (phones would pop up the keyboard).
  function refocus() {
    const textarea = textareaRef.current;
    if (!textarea || !hasFinePointer()) return;
    textarea.focus();
    if (textarea.form) revealForm(textarea.form);
  }

  // Picked or dropped files: those that fit are added, and a toast says why the rest weren't.
  function addFiles(files: Iterable<File>) {
    const { added, error } = attachFiles(attachments, files);
    if (added.length) setAttachments((current) => [...current, ...added]);
    if (error) showToast(error);
    refocus();
  }

  function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) addFiles(event.target.files);
    else refocus();
    // So picking the same file again still counts as a change.
    event.target.value = "";
  }

  function removeAttachment(attachment: Attachment) {
    setAttachments((current) => current.filter((other) => other.id !== attachment.id));
    URL.revokeObjectURL(attachment.url);
    refocus();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onSend) {
      goNext();
      return;
    }
    if (!canSend || busy) return;
    onSend(value.trim(), attachments);
    // Set at once: sending from the home page navigates away, which would free them.
    unsent.current = [];
    setAttachments([]);
    setValue("");
    // Shrink back to one line once the text is gone.
    requestAnimationFrame(() => {
      if (textareaRef.current) fitTextarea(textareaRef.current);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends and Shift+Enter adds a line. On touch keyboards Enter always adds a line.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    if (!hasFinePointer()) return;
    event.preventDefault();
    if (canSend) event.currentTarget.form?.requestSubmit();
  }

  return (
    <div className="w-full text-left">
      <form
        onSubmit={handleSubmit}
        className="relative scroll-my-4 rounded-3xl border border-zinc-950/10 bg-white/80 shadow-xl shadow-zinc-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/75 dark:shadow-black/30"
      >
        {attachments.length > 0 && (
          <AttachmentRow
            attachments={attachments}
            onView={setViewing}
            onRemove={removeAttachment}
          />
        )}

        <div className={`relative mx-2 ${attachments.length > 0 ? "" : "mt-2"}`}>
          <label htmlFor={id} className="sr-only">
            Describe the app you want to build
          </label>
          {value === "" && !placeholder && (
            <span
              key={exampleIndex}
              aria-hidden
              onAnimationEnd={() => setExampleIndex((index) => (index + 1) % EXAMPLES.length)}
              className="pointer-events-none absolute inset-x-0 top-0 truncate-fade px-3 pt-3 text-base/6 text-zinc-500 animate-placeholder-cycle motion-reduce:animate-placeholder-fade dark:text-zinc-400"
            >
              {EXAMPLES[exampleIndex]}
            </span>
          )}
          <textarea
            ref={textareaRef}
            id={id}
            rows={1}
            placeholder={placeholder}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              fitTextarea(event.target);
              if (event.target.form) revealForm(event.target.form);
            }}
            onKeyDown={handleKeyDown}
            onMouseMove={(event) => {
              // Chrome shows the text cursor over a custom-styled scrollbar, so switch it here.
              const textarea = event.currentTarget;
              textarea.style.cursor =
                event.nativeEvent.offsetX > textarea.clientWidth ? "default" : "";
            }}
            className="prompt-scrollbar scroll-fade-y block max-h-60 w-full resize-none overflow-y-auto bg-transparent px-3 pt-3 pb-2 text-base/6 outline-none placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
          />
        </div>

        <div className="flex items-center justify-between p-3 pt-1">
          {onSend && (
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT}
              tabIndex={-1}
              aria-hidden
              onChange={handleFiles}
              className="hidden"
            />
          )}
          <button
            type="button"
            aria-label="Add files"
            data-tooltip={onSend ? "Add files" : undefined}
            onClick={onSend ? () => fileInputRef.current?.click() : goNext}
            className="grid size-9 place-items-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <PlusIcon className="size-5" />
          </button>

          {/* One button: a mic while the box is empty, morphing into send once there is text or a file. */}
          <button
            type={canSend ? "submit" : "button"}
            aria-label={canSend ? "Send" : "Voice input"}
            aria-disabled={canSend && busy}
            data-tooltip={canSend ? "Send" : undefined}
            // With text it submits the form instead, and handleSubmit navigates.
            onClick={canSend ? undefined : goNext}
            className="group/send relative size-9 rounded-full text-zinc-600 transition-colors aria-disabled:cursor-default hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <span
              aria-hidden
              className={`absolute inset-0 rounded-full bg-brand-gradient shadow-md shadow-brand-magenta/30 transition duration-300 ease-spring motion-reduce:transition-none ${
                canSend
                  ? busy
                    ? "scale-100 opacity-40"
                    : "scale-100 opacity-100 group-hover/send:brightness-110"
                  : "scale-50 opacity-0"
              }`}
            />
            <MicIcon
              className={`absolute inset-0 m-auto size-5 transition duration-300 ease-spring motion-reduce:transition-none ${
                canSend ? "scale-50 -rotate-90 opacity-0" : ""
              }`}
            />
            <ArrowUpIcon
              className={`absolute inset-0 m-auto size-5 text-white transition duration-300 ease-spring motion-reduce:transition-none ${
                canSend ? "" : "translate-y-2 scale-50 opacity-0"
              }`}
            />
          </button>
        </div>
      </form>

      {onSend && <FileDrop onFiles={addFiles} />}
      <ImageViewer image={viewing} onClose={() => setViewing(null)} />
      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}

/*
 * The attached files, in a row above the text that scrolls sideways once they don't fit, fading out
 * at an edge with more beyond it. A mouse wheel scrolls it too, and newly added files scroll into view.
 */
function AttachmentRow({
  attachments,
  onView,
  onRemove,
}: {
  attachments: Attachment[];
  onView: (attachment: Attachment) => void;
  onRemove: (attachment: Attachment) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const count = useRef(attachments.length);
  useScrollFade(ref, "x");

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const onWheel = (event: WheelEvent) => {
      if (event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const max = box.scrollWidth - box.clientWidth;
      // Past either end, the wheel scrolls the page as usual.
      if (
        (event.deltaY < 0 && box.scrollLeft <= 0) ||
        (event.deltaY > 0 && box.scrollLeft >= max - 1)
      )
        return;
      event.preventDefault();
      // Firefox can count in lines.
      box.scrollLeft += event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1);
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const box = ref.current;
    if (box && attachments.length > count.current)
      box.scrollTo({ left: box.scrollWidth, behavior: "smooth" });
    count.current = attachments.length;
  }, [attachments.length]);

  return (
    <div
      ref={ref}
      className="prompt-scrollbar scroll-fade-x mx-2 mt-2 overflow-x-auto overscroll-x-contain [--fade-size:2rem]"
    >
      {/* One element that is always there, which useScrollFade watches as files come and go. */}
      <ul aria-label="Attached files" className="flex w-max gap-2 px-3 pt-3 pb-1">
        {attachments.map((attachment) => (
          <li key={attachment.id} className="animate-tile-in motion-reduce:animate-none">
            <AttachmentTile
              attachment={attachment}
              onView={() => onView(attachment)}
              onRemove={() => onRemove(attachment)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
