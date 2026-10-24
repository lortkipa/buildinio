import type { Metadata } from "next";
import Link from "next/link";
import { PRIMARY_BUTTON } from "./buttons";
import { STATUS_ACTION, StatusPage } from "./status-page";

export const metadata: Metadata = { title: "Page not found" };

// Any URL without a page, and any page calling notFound(). Home is the landing page when signed
// out, so it is the way back either way.
export default function NotFound() {
  return (
    <StatusPage
      code="404"
      heading="This page doesn’t exist"
      description="The link may be broken, or the page may have moved."
    >
      <Link href="/" className={`${STATUS_ACTION} ${PRIMARY_BUTTON}`}>
        Go home
      </Link>
    </StatusPage>
  );
}
