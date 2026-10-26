import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { OAUTH_COOKIES } from "@/lib/auth/oauth-cookies";
import { getOrigin } from "@/lib/auth/origin";
import {
  fetchProfile,
  isConfigured,
  isProvider,
  UnverifiedEmailError,
} from "@/lib/auth/providers";
import type { ProviderProfile } from "@/lib/auth/providers";
import { signInOrStartSignup } from "@/lib/auth/signup";

/**
 * Google and GitHub send people back here after they agree to sign in.
 * Known accounts go home; new ones go on to pick a name at /welcome.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/auth/[provider]/callback">,
) {
  const { provider } = await params;
  if (!isProvider(provider)) return new Response("Not found", { status: 404 });

  const store = await cookies();
  const expectedState = store.get(OAUTH_COOKIES.state)?.value;
  const codeVerifier = store.get(OAUTH_COOKIES.codeVerifier)?.value ?? "";
  const from = store.get(OAUTH_COOKIES.from)?.value === "login" ? "login" : "signup";
  Object.values(OAUTH_COOKIES).forEach((name) => store.delete(name));

  const query = request.nextUrl.searchParams;
  // They pressed Cancel on the provider's page: just take them back.
  if (query.get("error") === "access_denied") redirect(`/${from}`);

  const code = query.get("code");
  const state = query.get("state");
  if (!code || !expectedState || state !== expectedState || !isConfigured(provider)) {
    redirect(`/${from}?error=${provider}`);
  }

  let profile: ProviderProfile;
  try {
    profile = await fetchProfile(provider, await getOrigin(), code, codeVerifier);
  } catch (error) {
    if (error instanceof UnverifiedEmailError) redirect(`/${from}?error=unverified`);
    console.error(`Couldn't finish signing in with ${provider}:`, error);
    redirect(`/${from}?error=${provider}`);
  }

  const result = await signInOrStartSignup(profile);
  redirect(result === "new" ? "/welcome" : "/");
}
