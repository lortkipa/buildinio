import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import { codeEmail, LOGO_CID, LOGO_DARK_CID } from "@/lib/email/code-email";

// Resend's test sender works without a domain, but only delivers to your own address.
const DEFAULT_FROM = "buildinio <onboarding@resend.dev>";

/**
 * Emails a sign-in code. Without RESEND_API_KEY, prints the code in the
 * server console instead and returns "not-configured".
 */
export async function sendCodeEmail(
  to: string,
  code: string,
  minutes: number,
): Promise<"sent" | "not-configured" | "failed"> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `\n  ✉  Email isn't set up (RESEND_API_KEY is missing), so here's the code.\n` +
        `     ${to}: ${code}\n`,
    );
    return "not-configured";
  }

  // Only APP_URL, never the request's Host header: that could be forged to put a fake link in the email.
  const { subject, html, text } = codeEmail({ code, minutes, siteUrl: process.env.APP_URL });
  try {
    const [logo, logoDark] = await Promise.all([
      readFile(path.join(process.cwd(), "brand", "logo-email.png")),
      readFile(path.join(process.cwd(), "brand", "logo-email-dark.png")),
    ]);
    const { error } = await new Resend(apiKey).emails.send({
      from: process.env.EMAIL_FROM || DEFAULT_FROM,
      to,
      subject,
      html,
      text,
      attachments: [
        { filename: "buildinio.png", content: logo, contentId: LOGO_CID },
        { filename: "buildinio-dark.png", content: logoDark, contentId: LOGO_DARK_CID },
      ],
    });
    if (error) throw new Error(`${error.name}: ${error.message}`);
    return "sent";
  } catch (error) {
    console.error("Couldn't send the code email:", error);
    return "failed";
  }
}
