import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { THEME_COOKIE } from "@/lib/account/options";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";

const SIGNED_OUT_ONLY = ["/signup", "/login", "/welcome"];
const YEAR_S = 365 * 24 * 60 * 60;

export function proxy(request: NextRequest) {
  const user = getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  // Signed-in people have no business on the sign-up and log-in pages: send them home.
  if (user && SIGNED_OUT_ONLY.includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // The theme cookie is the database's theme for the signed-in user, and nothing otherwise
  // (see THEME_COOKIE). Set with the page, so the page's first script already sees it.
  const response = NextResponse.next();
  const cookie = request.cookies.get(THEME_COOKIE)?.value;
  if (user && cookie !== user.theme) {
    response.cookies.set(THEME_COOKIE, user.theme, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: YEAR_S,
    });
  } else if (!user && cookie !== undefined) {
    response.cookies.delete(THEME_COOKIE);
  }
  return response;
}

export const config = {
  // Pages (and their Server Actions and client-side loads), not files, API routes or previews.
  matcher: ["/((?!api/|_next/|preview/|.*\\.).*)"],
};
