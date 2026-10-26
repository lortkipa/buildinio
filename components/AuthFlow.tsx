"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode, RefObject } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CodeInput } from "@/components/CodeInput";
import { Header } from "@/components/Header";
import { GitHubIcon, GoogleIcon } from "@/components/ProviderIcons";
import { focusRing } from "@/components/styles";
import { DOCK_GAP, DOCK_TEXT_GAP, useKeyboardDock } from "@/components/useKeyboardDock";
import type { Dock } from "@/components/useKeyboardDock";

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

const stepBody = "mt-8 w-full motion-safe:animate-rise motion-safe:[animation-delay:160ms]";
const pill = "flex h-11 w-full items-center justify-center rounded-full text-sm font-medium";
const outlineButton = `${pill} cursor-pointer gap-3 border border-border bg-surface transition-colors hover:border-foreground/25 ${focusRing}`;
const primaryButton = `${pill} cursor-pointer bg-foreground text-background transition-colors enabled:hover:bg-foreground/85 disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-surface disabled:text-muted ${focusRing}`;
const textInput =
  "h-11 w-full rounded-full border border-border bg-surface px-5 text-left text-base text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/40 aria-[invalid=true]:border-error";

type Flow = { step: "start" } | { step: "code"; email: string } | { step: "name"; name: string };

export function AuthFlow({ mode }: { mode: "signup" | "login" }) {
  const router = useRouter();
  const [flow, setFlow] = useState<Flow>({ step: "start" });

  // Next keeps this page alive, hidden, after you navigate away (cacheComponents).
  // Start over when that happens, so every visit begins at the first step. Dev mode
  // also runs this right after the first render, so leave the first step untouched:
  // replacing it would replay its fade-in and flicker.
  useLayoutEffect(() => {
    return () => setFlow((current) => (current.step === "start" ? current : { step: "start" }));
  }, []);

  const startOver = () => setFlow({ step: "start" });
  let step: ReactNode;

  switch (flow.step) {
    case "start":
      step = (
        <StartStep
          heading={HEADINGS[mode]}
          onEmailSent={(email) => setFlow({ step: "code", email })}
          onProvider={() => setFlow({ step: "name", name: PROVIDER_NAME })}
        />
      );
      break;
    case "code":
      step = (
        <CodeStep
          email={flow.email}
          onVerified={() => setFlow({ step: "name", name: "" })}
          onBack={startOver}
        />
      );
      break;
    case "name":
      step = (
        <NameStep initialName={flow.name} onDone={() => router.push("/")} onBack={startOver} />
      );
      break;
  }

  return (
    <>
      <Header
        buttons={flow.step === "name" ? [] : mode === "signup" ? ["login"] : ["signup"]}
      />
      <main className="flex flex-1 flex-col items-center justify-center overflow-x-clip px-4 pt-10 pb-28 text-center sm:px-6">
        {/* Keyed so each step starts fresh and rises in. */}
        <div key={flow.step} className="flex w-full max-w-sm flex-col items-center">
          {step}
        </div>
      </main>
    </>
  );
}

type StepHeadingProps = {
  title: string;
  subtitle: ReactNode;
  dock?: Dock | null; // Set while the phone keyboard is open; see useKeyboardDock.
};

function StepHeading({ title, subtitle, dock = null }: StepHeadingProps) {
  return (
    // While the phone keyboard is open, keep the text at the top of what's visible.
    <div
      style={
        dock
          ? {
              position: "fixed",
              left: dock.boxLeft,
              width: dock.boxWidth,
              top: dock.visibleTop + DOCK_TEXT_GAP,
            }
          : undefined
      }
      className="flex flex-col items-center"
    >
      {/* Smaller while docked, so it fits above the keyboard on small phones. */}
      <h1
        className={`leading-tight font-semibold tracking-[-0.02em] text-balance motion-safe:animate-rise ${
          dock ? "text-2xl" : "text-3xl sm:text-4xl"
        }`}
      >
        {title}
      </h1>
      <p
        className={`max-w-full text-base text-balance text-muted motion-safe:animate-rise motion-safe:[animation-delay:80ms] ${
          dock ? "mt-2" : "mt-3"
        }`}
      >
        {subtitle}
      </p>
    </div>
  );
}

type BackButtonProps = {
  onClick: () => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  className?: string;
};

function BackButton({ onClick, buttonRef, className = "mt-6" }: BackButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      className={`mx-auto flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium text-muted transition-colors hover:bg-foreground/5 hover:text-foreground ${focusRing} ${className}`}
    >
      <ArrowLeft size={16} />
      Use a different email
    </button>
  );
}

type StartStepProps = {
  heading: { title: string; subtitle: string };
  onEmailSent: (email: string) => void;
  onProvider: () => void;
};

function StartStep({ heading, onEmailSent, onProvider }: StartStepProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId(); // Hidden pages stay in the DOM, so fixed ids could clash.

  // Clear the form when the page is hidden (see AuthFlow), so the next visit starts fresh.
  useLayoutEffect(() => {
    return () => {
      setEmail("");
      setError("");
    };
  }, []);

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
      <StepHeading title={heading.title} subtitle={heading.subtitle} />
      <div className={stepBody}>
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
      </div>
    </>
  );
}

type CodeStepProps = {
  email: string;
  onVerified: () => void;
  onBack: () => void;
};

function CodeStep({ email, onVerified, onBack }: CodeStepProps) {
  const [wrong, setWrong] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);
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
      <StepHeading
        title="Check your email"
        subtitle={
          <>
            Enter the 6-digit code we sent to{" "}
            <span className="font-medium wrap-anywhere text-foreground">{email}</span>.
          </>
        }
      />
      <div className={stepBody}>
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
        <BackButton onClick={onBack} buttonRef={backRef} />
      </div>
    </>
  );
}

type NameStepProps = {
  initialName: string; // Filled in after Google or GitHub.
  onDone: () => void;
  onBack: () => void;
};

function NameStep({ initialName, onDone, onBack }: NameStepProps) {
  const [name, setName] = useState(initialName);
  const stepRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dock = useKeyboardDock(inputRef, stepRef);
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
    // Keeps its height while docked, so the page doesn't jump.
    <div
      ref={stepRef}
      style={dock ? { height: dock.keptHeight } : undefined}
      className="flex w-full flex-col items-center"
    >
      <StepHeading title="What should we call you?" subtitle="Your first name is fine." dock={dock} />
      <form onSubmit={handleSubmit} className={stepBody}>
        {/* While the phone keyboard is open, sit right above it. */}
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
          className="flex flex-col gap-3"
        >
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
          {/* preventDefault keeps focus in the input, so tapping a button
              doesn't close the phone keyboard and move the buttons mid-tap. */}
          <div onMouseDown={(event) => event.preventDefault()} className="flex flex-col gap-3">
            <button type="submit" disabled={!hasName} className={primaryButton}>
              Continue
            </button>
            <BackButton onClick={onBack} className={dock ? "" : "mt-3"} />
          </div>
        </div>
      </form>
    </div>
  );
}
