import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";

/** Signed-in people have no business on the sign-up and log-in pages: send them home. */
export function proxy(request: NextRequest) {
  if (getSessionUser(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/signup", "/login", "/welcome"],
};
