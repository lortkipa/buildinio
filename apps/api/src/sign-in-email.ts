import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Email } from "./mailer";

/*
 * The logo with the name, for dark backgrounds: an unchanged copy of assets/brand/ (the API's
 * Docker build only sees apps/api). Resolved from this file's folder, which is src/ in
 * development and dist/ when built: both sit next to assets/, and the Dockerfile copies it there.
 */
const LOGO = readFileSync(new URL("../assets/buildinio-logo-dark-bg.png", import.meta.url));
const LOGO_CID = "logo@buildinio";

// The web app's colors (apps/web/app/globals.css) and Tailwind's zinc grays.
const PAGE = "#fffaf7";
const INK = "#09090f";
const BRAND_GRADIENT = "#ffb21e, #ff4f6d, #e23fa8, #7a5bff, #2e9bff";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/*
 * The email with a sign-in code. The logo is attached (cid:) rather than linked, so it shows
 * without loading remote images. It sits on a dark band in every color scheme: mail apps that
 * darken emails (Gmail's and Outlook's) recolor backgrounds and text but not images, and the
 * logo's white name stays readable on a band that is dark already. Apple Mail follows the
 * dark-mode styles below instead. Outlook for Windows ignores max-width, hence the fixed-width
 * table only it reads ([if mso]).
 */
export function signInEmail({
  to,
  code,
  expiresMinutes,
  appUrl,
}: {
  to: string;
  code: string;
  expiresMinutes: number;
  appUrl: string;
}): Email {
  const expires = `${expiresMinutes} ${expiresMinutes === 1 ? "minute" : "minutes"}`;
  const host = new URL(appUrl).host;
  const site = escapeHtml(appUrl);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Your Buildinio sign-in code</title>
<style>
  @media (prefers-color-scheme: dark) {
    .page { background-color: ${INK} !important; }
    .card { background-color: #18181b !important; border-color: #27272a !important; }
    .heading, .code { color: #fafafa !important; }
    .text { color: #d4d4d8 !important; }
    .muted, .footer, .footer a { color: #a1a1aa !important; }
    .code-box { background-color: #1e1a33 !important; border-color: #3b3266 !important; }
  }
</style>
</head>
<body class="page" style="margin:0;padding:0;background-color:${PAGE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">It expires in ${expires}. Never share it with anyone.${"&#8203;&nbsp;".repeat(60)}</div>
<table role="presentation" class="page" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE};">
<tr><td align="center" style="padding:40px 16px;">
  <!--[if mso]><table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
  <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#ffffff;border:1px solid #ede7e3;border-radius:20px;overflow:hidden;">
    <tr><td bgcolor="${INK}" style="background-color:${INK};padding:28px 36px;">
      <img src="cid:${LOGO_CID}" width="140" height="27" alt="Buildinio" style="display:block;border:0;width:140px;height:auto;">
    </td></tr>
    <tr><td height="4" bgcolor="#7a5bff" style="height:4px;line-height:4px;font-size:0;background-color:#7a5bff;background-image:linear-gradient(90deg, ${BRAND_GRADIENT});">&nbsp;</td></tr>
    <tr><td style="padding:36px 36px 32px;font-family:${FONT};">
      <h1 class="heading" style="margin:0 0 12px;font-size:24px;line-height:32px;font-weight:700;color:${INK};">Your sign-in code</h1>
      <p class="text" style="margin:0 0 28px;font-size:16px;line-height:24px;color:#52525b;">Enter this code on Buildinio to sign in or create your account. It expires in ${expires}.</p>
      <table role="presentation" class="code-box" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f3ff;border:1px solid #e4dfff;border-radius:14px;">
        <tr><td align="center" style="padding:22px 12px;">
          <span class="code" style="font-family:${FONT};font-size:38px;line-height:44px;font-weight:700;letter-spacing:10px;padding-left:10px;color:${INK};font-variant-numeric:tabular-nums;">${code}</span>
        </td></tr>
      </table>
      <p class="muted" style="margin:28px 0 0;font-size:14px;line-height:21px;color:#71717a;">If you didn’t ask for this code, you can ignore this email. No one can sign in without it.</p>
      <p class="muted" style="margin:8px 0 0;font-size:14px;line-height:21px;color:#71717a;">Never share this code. Buildinio will never ask you for it.</p>
    </td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
    <tr><td class="footer" align="center" style="padding:24px 36px 0;font-family:${FONT};font-size:12px;line-height:18px;color:#a1a1aa;">
      Sent to ${escapeHtml(to)} because this address was entered at <a href="${site}" style="color:#a1a1aa;text-decoration:underline;">${escapeHtml(host)}</a>.<br>
      Buildinio · An AI app builder for everyone
    </td></tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;

  const text = `Your Buildinio sign-in code: ${code}

Enter this code on Buildinio to sign in or create your account. It expires in ${expires}.

If you didn't ask for this code, you can ignore this email. No one can sign in without it.
Never share this code. Buildinio will never ask you for it.

Sent to ${to} because this address was entered at ${appUrl}.
`;

  return {
    to,
    // The code first, so it shows in notifications.
    subject: `${code} is your Buildinio sign-in code`,
    html,
    text,
    attachments: [{ filename: "buildinio-logo.png", content: LOGO, cid: LOGO_CID }],
    headers: {
      // A new value each time keeps Gmail from collapsing the codes into one thread.
      "X-Entity-Ref-ID": randomUUID(),
      "Auto-Submitted": "auto-generated",
    },
  };
}
