import { createTransport } from "nodemailer";
import { isProduction, readInteger, readString } from "./env";

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Images the HTML shows with src="cid:<cid>".
  attachments?: { filename: string; content: Buffer; cid: string }[];
  headers?: Record<string, string>;
};

export type Mailer = { send: (email: Email) => Promise<void> };

const SMTP_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM"];

/*
 * Sends email over SMTP, so any provider works (Brevo, Amazon SES, Resend, ...; see .env.example).
 * Without SMTP settings there is no mailer: development prints the sign-in codes in the API's
 * console instead, and production refuses to start, since no one could sign in with email.
 */
export function createMailer(): Mailer | null {
  const host = readString("SMTP_HOST");
  const from = readString("EMAIL_FROM");
  if (!host || !from) {
    const someSet = SMTP_KEYS.some((key) => readString(key) !== undefined);
    if (someSet || isProduction) {
      throw new Error(
        "Email sign-in needs SMTP_HOST and EMAIL_FROM in .env (plus SMTP_USER and SMTP_PASSWORD for most providers). See .env.example.",
      );
    }
    console.warn("Email sending is off: sign-in codes are printed here. Set SMTP_* in .env.");
    return null;
  }

  const port = readInteger("SMTP_PORT", 587);
  const user = readString("SMTP_USER");
  const pass = readString("SMTP_PASSWORD");
  const transport = createTransport(
    {
      pool: true,
      host,
      port,
      // 465 is TLS from the start; other ports upgrade with STARTTLS when the server offers it.
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
      // Fail within the request instead of after Nodemailer's default of minutes.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    },
    { from },
  );

  // Only a warning: the provider may be back by the time someone signs in.
  transport.verify().catch((error) => {
    console.warn(`Couldn't connect to the SMTP server ${host}:${port}:`, error);
  });

  return {
    async send(email) {
      await transport.sendMail(email);
    },
  };
}
