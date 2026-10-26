import { AccountMenu } from "@/components/AccountMenu";
import { AuthLinks } from "@/components/Header";
import { getCurrentUser } from "@/lib/auth/session";

/** The top right of the header: the account menu when signed in, otherwise Log in and Sign up. */
export async function HeaderAccount() {
  const user = await getCurrentUser();
  // Keyed by user, so the menu never carries state over from someone else.
  return user ? <AccountMenu key={user.id} user={user} /> : <AuthLinks />;
}

/** Holds the space while HeaderAccount loads, so the header doesn't jump. */
export function HeaderAccountFallback() {
  return <div aria-hidden className="h-9" />;
}
