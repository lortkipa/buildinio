import Image from "next/image";
import Link from "next/link";
import logo from "@/brand/logo.svg";
import logoDark from "@/brand/logo-dark.svg";
import { focusRing } from "@/components/styles";

type AuthButton = "login" | "signup";

/** The signed-out header: the logo, plus `buttons` (which of Log in and Sign up) at the top right. */
export function Header({ buttons = ["login", "signup"] }: { buttons?: AuthButton[] }) {
  return (
    <header>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className={`rounded-md ${focusRing}`}>
          <Image
            src={logo}
            alt="buildinio"
            loading="eager"
            className="h-7 w-auto dark:hidden"
          />
          <Image
            src={logoDark}
            alt="buildinio"
            loading="eager"
            className="hidden h-7 w-auto dark:block"
          />
        </Link>

        <AuthLinks buttons={buttons} />
      </div>
    </header>
  );
}

function AuthLinks({ buttons }: { buttons: AuthButton[] }) {
  if (buttons.length === 0) return null;
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {buttons.includes("login") && (
        <Link
          href="/login"
          className={`flex h-9 items-center rounded-full px-4 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground ${focusRing}`}
        >
          Log in
        </Link>
      )}
      {buttons.includes("signup") && (
        <Link
          href="/signup"
          className={`flex h-9 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/85 ${focusRing}`}
        >
          Sign up
        </Link>
      )}
    </div>
  );
}
