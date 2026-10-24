"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CANCEL_BUTTON, DIALOG_TITLE, Dialog, PRIMARY_BUTTON } from "./dialog";
import { CheckIcon, LoaderIcon } from "./icons";
import { HINT } from "./settings-parts";

// How long the mocked sending takes.
const SEND_MS = 800;

// Mocked: nothing reaches the API yet, the message is dropped. Becomes a request to the API.
function sendFeedback(_message: string, onSent: () => void) {
  const timer = setTimeout(onSent, SEND_MS);
  return () => clearTimeout(timer);
}

/*
 * Send feedback, from the account menu: a message and Send, then a thank-you. AppShell renders it
 * once, after the phone sheet, so it opens above it.
 *
 * session: a new number each time it opens, for an empty message.
 */
export function FeedbackDialog({
  open,
  session,
  onClose,
}: {
  open: boolean;
  session: number;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      className="w-[min(calc(100%-2rem),28rem)]"
    >
      <FeedbackForm key={session} titleId={titleId} onDone={onClose} />
    </Dialog>
  );
}

function FeedbackForm({ titleId, onDone }: { titleId: string; onDone: () => void }) {
  const fieldId = useId();
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"writing" | "sending" | "sent">("writing");
  const doneRef = useRef<HTMLButtonElement>(null);
  // Cancels the mocked sending, e.g. when the dialog closes before it's done.
  const cancelSend = useRef<() => void>(undefined);
  const trimmed = message.trim();

  useEffect(() => () => cancelSend.current?.(), []);

  // The field goes, which had the focus: Done takes it.
  useEffect(() => {
    if (state === "sent") doneRef.current?.focus();
  }, [state]);

  function send() {
    if (state !== "writing" || trimmed === "") return;
    setState("sending");
    cancelSend.current = sendFeedback(trimmed, () => setState("sent"));
  }

  if (state === "sent")
    return (
      <div role="status" className="flex flex-col items-center p-5 pt-8 text-center">
        <span className="grid size-14 animate-pick place-items-center rounded-full bg-emerald-500/10 text-emerald-600 motion-reduce:animate-none dark:text-emerald-400">
          <CheckIcon className="size-7" />
        </span>
        <h2 id={titleId} className={`mt-4 ${DIALOG_TITLE}`}>
          Thanks for your feedback
        </h2>
        <p className={`mt-2 ${HINT}`}>It helps us make Buildinio better.</p>
        <button ref={doneRef} type="button" onClick={onDone} className={`mt-6 ${PRIMARY_BUTTON}`}>
          Done
        </button>
      </div>
    );

  const sending = state === "sending";
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      className="p-5"
    >
      <h2 id={titleId} className={DIALOG_TITLE}>
        Send feedback
      </h2>
      <p className={`mt-2 ${HINT}`}>
        What’s working, what isn’t, what you’d like to see. We read every message.
      </p>
      <label htmlFor={fieldId} className="sr-only">
        Your feedback
      </label>
      {/* text-base: iOS zooms into fields with smaller text. */}
      <textarea
        id={fieldId}
        data-autofocus
        rows={5}
        maxLength={2000}
        placeholder="Your feedback"
        value={message}
        // Not disabled: that would drop the focus and close the phone keyboard.
        readOnly={sending}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          // Enter is a new line; Ctrl+Enter or ⌘+Enter sends.
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            send();
          }
        }}
        className="prompt-scrollbar mt-4 block w-full resize-none rounded-2xl border border-zinc-950/10 bg-white px-4 py-3 text-base outline-none transition-colors placeholder:text-zinc-500 focus:border-brand-violet dark:border-white/10 dark:bg-zinc-950/40 dark:placeholder:text-zinc-400"
      />
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onDone} disabled={sending} className={CANCEL_BUTTON}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={trimmed === ""}
          aria-disabled={sending}
          className={`flex items-center gap-2 aria-disabled:cursor-default ${PRIMARY_BUTTON}`}
        >
          {sending && <LoaderIcon className="size-4" />}
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
