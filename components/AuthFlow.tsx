"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode, RefObject } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { CodeInput } from "@/components/CodeInput";
import { Header } from "@/components/Header";
import { GitHubIcon, GoogleIcon } from "@/components/ProviderIcons";
import { focusRing } from "@/components/styles";
import { DOCK_GAP, DOCK_TEXT_GAP, useKeyboardDock } from "@/components/useKeyboardDock";
import type { Dock } from "@/components/useKeyboardDock";
import {
  cancelSignup,
  completeSignup,
  sendEmailCode,
  startOAuth,
  verifyEmailCode,
} from "@/lib/auth/actions";

// Sign-up and log-in work the same way: the server logs in if the email
// already has an account, and otherwise creates one after the name step.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 80;

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

// Set by the Google/GitHub callback when signing in didn't work.
const CALLBACK_ERRORS: Record<string, string> = {
  google: "Couldn’t sign in with Google. Please try again.",
  github: "Couldn’t sign in with GitHub. Please try again.",
  unverified: "That account has no verified email. Verify it first, or use another way in.",
};

const stepBody = "mt-8 w-full motion-safe:animate-rise motion-safe:[animation-delay:160ms]";
const pill = "flex h-11 w-full items-center justify-center rounded-full text-sm font-medium";
const outlineButton = `${pill} cursor-pointer gap-3 border border-border bg-surface transition-colors enabled:hover:border-foreground/25 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;
const primaryButton = `${pill} cursor-pointer gap-2 bg-foreground text-background transition-colors enabled:hover:bg-foreground/85 disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-surface disabled:text-muted ${focusRing}`;
const textInput =
  "h-11 w-full rounded-full border border-border bg-surface px-5 text-left text-base text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/40 aria-[invalid=true]:border-error";

type Flow = { step: "start" } | { step: "code"; email: string } | { step: "name"; name: string };

type AuthFlowProps = {
  mode: "signup" | "login";
  initialFlow?: Flow; // /welcome starts at the name step, filled in from Google or GitHub.
};

export function AuthFlow({ mode, initialFlow }: AuthFlowProps) {
  const router = useRouter();
  const [initial] = useState<Flow>(initialFlow ?? { step: "start" });
  const [flow, setFlow] = useState<Flow>(initial);

  // Next keeps this page alive, hidden, after you navigate away (cacheComponents).
  // Start over when that happens, so every visit begins at the first step. Dev mode
  // also runs this right after the first render; setting the same object again is
  // a no-op, so the first step doesn't replay its fade-in and flicker.
  useLayoutEffect(() => {
    return () => setFlow(initial);
  }, [initial]);

  // Show why signing in with Google or GitHub failed, then tidy the URL.
  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (!error) return;
    toast.error(CALLBACK_ERRORS[error] ?? "Something went wrong. Please try again.");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  function startOver() {
    if (initialFlow) {
      router.replace("/signup"); // /welcome has no first step of its own.
    } else {
      setFlow({ step: "start" });
    }
  }

  let step: ReactNode;

  switch (flow.step) {
    case "start":
      step = (
        <StartStep
          mode={mode}
          onEmailSent={(email) => setFlow({ step: "code", email })}
        />
      );
      break;
    case "code":
      step = (
        <CodeStep
          email={flow.email}
          onNewAccount={() => setFlow({ step: "name", name: "" })}
          onBack={startOver}
        />
      );
      break;
    case "name":
      step = <NameStep initialName={flow.name} onBack={startOver} />;
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
  subtitle?: ReactNode;
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
      {subtitle && (
        <p
          className={`max-w-full text-base text-balance text-muted motion-safe:animate-rise motion-safe:[animation-delay:80ms] ${
            dock ? "mt-2" : "mt-3"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

type BackButtonProps = {
  onClick: () => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  disabled?: boolean;
  className?: string;
};

function BackButton({ onClick, buttonRef, disabled, className = "mt-6" }: BackButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`mx-auto flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium text-muted transition-colors enabled:hover:bg-foreground/5 enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${className}`}
    >
      <ArrowLeft size={16} />
      Use a different email
    </button>
  );
}

function Spinner() {
  return <LoaderCircle aria-hidden className="size-[18px] motion-safe:animate-spin" />;
}

type StartStepProps = {
  mode: "signup" | "login";
  onEmailSent: (email: string) => void;
};

function StartStep({ mode, onEmailSent }: StartStepProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"google" | "github" | "email" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId(); // Hidden pages stay in the DOM, so fixed ids could clash.
  const heading = HEADINGS[mode];

  // Clear the form when the page is hidden (see AuthFlow), so the next visit starts fresh.
  useLayoutEffect(() => {
    return () => {
      setEmail("");
      setError("");
      setBusy(null);
    };
  }, []);

  // Coming back from Google or GitHub with the browser's back button can restore
  // this page as it was, mid-redirect. Make the buttons usable again.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => event.persisted && setBusy(null);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  async function handleProvider(provider: "google" | "github") {
    setBusy(provider);
    const result = await startOAuth(provider, mode);
    if ("url" in result) {
      window.location.assign(result.url); // Stays busy until the provider's page loads.
    } else {
      setBusy(null);
      toast.error(result.error);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const value = email.trim();
    const problem = !value ? "Enter your email." : !EMAIL.test(value) ? "Enter a valid email." : "";
    if (problem) {
      setError(problem);
      inputRef.current?.focus();
      return;
    }

    setBusy("email");
    const result = await sendEmailCode(value);
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.warning) toast.warning(result.warning);
    onEmailSent(value);
  }

  return (
    <>
      <StepHeading title={heading.title} subtitle={heading.subtitle} />
      <div className={stepBody}>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => handleProvider("google")}
            disabled={busy !== null}
            className={outlineButton}
          >
            {busy === "google" ? <Spinner /> : <GoogleIcon className="size-[18px]" />}
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => handleProvider("github")}
            disabled={busy !== null}
            className={outlineButton}
          >
            {busy === "github" ? <Spinner /> : <GitHubIcon className="size-[18px]" />}
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
          <button type="submit" disabled={busy !== null} className={primaryButton}>
            {busy === "email" && <Spinner />}
            {busy === "email" ? "Sending code…" : "Continue with email"}
          </button>
        </form>
      </div>
    </>
  );
}

type CodeStepProps = {
  email: string;
  onNewAccount: () => void;
  onBack: () => void;
};

function CodeStep({ email, onNewAccount, onBack }: CodeStepProps) {
  const [status, setStatus] = useState<"idle" | "checking" | "wrong" | "expired">("idle");
  const backRef = useRef<HTMLButtonElement>(null);
  const errorId = useId();
  const failed = status === "wrong" || status === "expired";

  async function handleComplete(code: string) {
    setStatus("checking");
    // Known emails are logged in and sent home by the server.
    const result = await verifyEmailCode(email, code);
    if (!result) return;
    if (result.status === "new") {
      onNewAccount();
    } else {
      // One try per code: the boxes lock and going back is the only way on.
      setStatus(result.status);
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
          locked={failed}
          disabled={status === "checking"}
          errorId={failed ? errorId : undefined}
        />
        {failed && (
          <p id={errorId} role="alert" className="mt-4 text-sm text-balance text-error">
            {status === "wrong" ? "That code isn’t right." : "That code has expired."} Go back
            and enter your email to get a new one.
          </p>
        )}
        <BackButton onClick={onBack} buttonRef={backRef} disabled={status === "checking"} />
      </div>
    </>
  );
}

type NameStepProps = {
  initialName: string; // Filled in after Google or GitHub.
  onBack: () => void;
};

function NameStep({ initialName, onBack }: NameStepProps) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasName || busy) return;
    setBusy(true);
    // On success the server creates the account and sends us home.
    const result = await completeSignup(name);
    setBusy(false);
    if (!result) return;
    toast.error(result.error);
    if (result.expired) onBack();
  }

  function handleBack() {
    void cancelSignup();
    onBack();
  }

  return (
    // Keeps its height while docked, so the page doesn't jump.
    <div
      ref={stepRef}
      style={dock ? { height: dock.keptHeight } : undefined}
      className="flex w-full flex-col items-center"
    >
      <StepHeading title="What should we call you?" dock={dock} />
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
            maxLength={MAX_NAME}
            placeholder="Your name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={textInput}
          />
          {/* preventDefault keeps focus in the input, so tapping a button
              doesn't close the phone keyboard and move the buttons mid-tap. */}
          <div onMouseDown={(event) => event.preventDefault()} className="flex flex-col gap-3">
            <button type="submit" disabled={!hasName || busy} className={primaryButton}>
              {busy && <Spinner />}
              Continue
            </button>
            <BackButton onClick={handleBack} disabled={busy} className={dock ? "" : "mt-3"} />
          </div>
        </div>
      </form>
    </div>
  );
}
