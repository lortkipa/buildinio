"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode, RefObject } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CodeInput } from "@/components/CodeInput";
import { Header } from "@/components/Header";
import { GitHubIcon, GoogleIcon } from "@/components/ProviderIcons";
import { focusRing } from "@/components/styles";

// Design mock only: nothing is sent or stored.
const TEST_CODE = "123456"; // The only code that works.
const PROVIDER_NAME = "Alex Morgan"; // Stands in for the name Google or GitHub would send.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HEADINGS = {
  signup: {
    title: "Your app is one step away",
    subtitle: "Create an account and we’ll start building it.",
  },
  login: {
    title: "Welcome back",
    subtitle: "Log in to keep building.",
  },
};

const pill = "flex h-11 w-full items-center justify-center rounded-full text-sm font-medium";
const outlineButton = `${pill} cursor-pointer gap-3 border border-border bg-surface transition-colors hover:border-foreground/25 ${focusRing}`;
const primaryButton = `${pill} cursor-pointer bg-foreground text-background transition-colors enabled:hover:bg-foreground/85 disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-surface disabled:text-muted ${focusRing}`;
const textInput =
  "h-11 w-full rounded-full border border-border bg-surface px-5 text-left text-base text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/40 aria-[invalid=true]:border-error";

type Flow = { step: "start" } | { step: "code"; email: string } | { step: "name"; name: string };

export function AuthFlow({ mode }: { mode: "signup" | "login" }) {
  const router = useRouter();
  const [flow, setFlow] = useState<Flow>({ step: "start" });
  const [visit, setVisit] = useState(0);
  const backRef = useRef<HTMLButtonElement>(null);

  // Next keeps this page alive, hidden, after you navigate away (cacheComponents).
  // Start over when that happens, so every visit begins at the first step.
  useLayoutEffect(() => {
    return () => {
      setFlow({ step: "start" });
      setVisit((count) => count + 1);
    };
  }, []);

  let title: string;
  let subtitle: ReactNode;
  let body: ReactNode;

  switch (flow.step) {
    case "start":
      title = HEADINGS[mode].title;
      subtitle = HEADINGS[mode].subtitle;
      body = (
        <StartStep
          onEmailSent={(email) => setFlow({ step: "code", email })}
          onProvider={() => setFlow({ step: "name", name: PROVIDER_NAME })}
        />
      );
      break;
    case "code":
      title = "Check your email";
      subtitle = (
        <>
          Enter the 6-digit code we sent to{" "}
          <span className="font-medium wrap-anywhere text-foreground">{flow.email}</span>.
        </>
      );
      body = (
        <CodeStep
          onVerified={() => setFlow({ step: "name", name: "" })}
          backRef={backRef}
        />
      );
      break;
    case "name":
      title = "What should we call you?";
      subtitle = "Your first name is fine.";
      body = <NameStep initialName={flow.name} onDone={() => router.push("/")} />;
      break;
  }

  return (
    <>
      <Header
        buttons={flow.step === "name" ? [] : mode === "signup" ? ["login"] : ["signup"]}
      />
      <main className="flex flex-1 flex-col items-center justify-center overflow-x-clip px-4 pt-10 pb-28 text-center sm:px-6">
        {/* Keyed so each step starts fresh and rises in. */}
        <div key={`${visit}-${flow.step}`} className="flex w-full max-w-sm flex-col items-center">
          <h1 className="text-3xl leading-tight font-semibold tracking-[-0.02em] text-balance motion-safe:animate-rise sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-full text-base text-balance text-muted motion-safe:animate-rise motion-safe:[animation-delay:80ms]">
            {subtitle}
          </p>
          <div className="mt-8 w-full motion-safe:animate-rise motion-safe:[animation-delay:160ms]">
            {body}
            {flow.step !== "start" && (
              <button
                ref={backRef}
                type="button"
                onClick={() => setFlow({ step: "start" })}
                className={`mx-auto mt-6 flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium text-muted transition-colors hover:bg-foreground/5 hover:text-foreground ${focusRing}`}
              >
                <ArrowLeft size={16} />
                Use a different email
              </button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

type StartStepProps = {
  onEmailSent: (email: string) => void;
  onProvider: () => void;
};

function StartStep({ onEmailSent, onProvider }: StartStepProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId(); // Hidden pages stay in the DOM, so fixed ids could clash.

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    const problem = !value ? "Enter your email." : !EMAIL.test(value) ? "Enter a valid email." : "";
    if (problem) {
      setError(problem);
      inputRef.current?.focus();
    } else {
      onEmailSent(value);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <button type="button" onClick={onProvider} className={outlineButton}>
          <GoogleIcon className="size-[18px]" />
          Continue with Google
        </button>
        <button type="button" onClick={onProvider} className={outlineButton}>
          <GitHubIcon className="size-[18px]" />
          Continue with GitHub
        </button>
      </div>

      <div className="my-6 flex items-center gap-4">
        <span aria-hidden className="h-px flex-1 bg-border" />
        <span className="text-sm text-muted">or</span>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>

      {/* noValidate: show our own messages instead of the browser's. */}
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor={`${id}-email`} className="sr-only">
          Email
        </label>
        <input
          ref={inputRef}
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          spellCheck={false}
          placeholder="Email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError("");
          }}
          aria-invalid={error !== ""}
          aria-describedby={error ? `${id}-error` : undefined}
          className={textInput}
        />
        {error && (
          <p id={`${id}-error`} role="alert" className="px-5 text-left text-sm text-error">
            {error}
          </p>
        )}
        <button type="submit" className={primaryButton}>
          Continue with email
        </button>
      </form>
    </>
  );
}

type CodeStepProps = {
  onVerified: () => void;
  backRef: RefObject<HTMLButtonElement | null>;
};

function CodeStep({ onVerified, backRef }: CodeStepProps) {
  const [wrong, setWrong] = useState(false);
  const errorId = useId();

  function handleComplete(code: string) {
    if (code === TEST_CODE) {
      onVerified();
    } else {
      // One try per code: the boxes lock and going back is the only way on.
      setWrong(true);
      backRef.current?.focus();
    }
  }

  return (
    <>
      <CodeInput
        onComplete={handleComplete}
        locked={wrong}
        errorId={wrong ? errorId : undefined}
      />
      {wrong && (
        <p id={errorId} role="alert" className="mt-4 text-sm text-balance text-error">
          That code isn&rsquo;t right. Go back and enter your email to get a new one.
        </p>
      )}
    </>
  );
}

type NameStepProps = {
  initialName: string; // Filled in after Google or GitHub.
  onDone: () => void;
};

function NameStep({ initialName, onDone }: NameStepProps) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const hasName = name.trim().length > 0;

  // Put the cursor at the end of the name on desktop. Skipped on touch so the keyboard doesn't pop up.
  useEffect(() => {
    const el = inputRef.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasName) onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor={`${id}-name`} className="sr-only">
        Your name
      </label>
      <input
        ref={inputRef}
        id={`${id}-name`}
        type="text"
        autoComplete="name"
        autoCapitalize="words"
        placeholder="Your name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className={textInput}
      />
      <button type="submit" disabled={!hasName} className={primaryButton}>
        Continue
      </button>
    </form>
  );
}
