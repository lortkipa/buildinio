import Image from "next/image";
import Link from "next/link";
import logo from "@/brand/logo.svg";
import logoDark from "@/brand/logo-dark.svg";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

export function Header() {
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

        {/* Not wired up yet. */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            className={`h-9 cursor-pointer rounded-full px-4 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground ${focusRing}`}
          >
            Log in
          </button>
          <button
            type="button"
            className={`h-9 cursor-pointer rounded-full bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/85 ${focusRing}`}
          >
            Sign up
          </button>
        </div>
      </div>
    </header>
  );
}
