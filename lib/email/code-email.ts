// The email with a sign-in code. Built with tables and inline styles, since
// that's what email apps (Gmail, Outlook, Apple Mail) render reliably.

// Brand colors (see brand/README.md), as plain hex: some email apps drop rgb() with alpha.
const ink = "#1c1c1f";
const muted = "#6b6b73";
const faint = "#8a8a92";
const page = "#f4f4f3";
const boxBorder = "#e3e3e5";
const boxFill = "#fafaf9";
const font =
  "Onest, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Content ids of the logos, attached inline so they show without hosting them anywhere.
 * The light one sits on a badge in the page color: invisible in light mode, but it
 * keeps the logo readable in apps that force dark mode by darkening everything except
 * images (like Gmail's phone app). Apps that support dark-mode CSS get the white logo instead.
 */
export const LOGO_CID = "logo";
export const LOGO_DARK_CID = "logo-dark";

const styles = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
/* Phones: smaller boxes and padding so all six digits fit on one line. */
@media (max-width: 480px) {
  .card { padding: 36px 20px !important; }
  .digit { width: 40px !important; height: 52px !important; font-size: 24px !important; border-radius: 12px !important; }
  .gap { width: 6px !important; }
}
/* Dark mode, for apps that support it (Apple Mail, iOS Mail, Outlook). */
@media (prefers-color-scheme: dark) {
  .page { background: #111113 !important; }
  .card { background: #1c1c1f !important; }
  .digit { background: #27272a !important; border-color: #3f3f46 !important; color: #ffffff !important; }
  .ink { color: #ffffff !important; }
  .muted, .muted a { color: #a1a1aa !important; }
  .logo-light { display: none !important; }
  .logo-dark { display: block !important; }
}
/* [data-ogsc] is how Outlook.com and the Outlook apps mark their dark mode. */
[data-ogsc] .ink, [data-ogsc] .digit { color: #ffffff !important; }
[data-ogsc] .muted, [data-ogsc] .muted a { color: #a1a1aa !important; }
[data-ogsc] .logo-light { display: none !important; }
[data-ogsc] .logo-dark { display: block !important; }`;

type CodeEmailProps = {
  code: string;
  minutes: number; // How long the code works.
  siteUrl?: string; // Linked in the footer when known.
};

export function codeEmail({ code, minutes, siteUrl }: CodeEmailProps) {
  const subject = `${code} is your buildinio code`;
  const preview = `Your buildinio code is ${code}. It expires in ${minutes} minutes.`;
  const site = siteUrl
    ? `<a href="${escape(siteUrl)}" style="color:${faint};text-decoration:underline;">buildinio</a>`
    : "buildinio";

  // One box per digit, like the code boxes on the sign-in page.
  const digits = code
    .split("")
    .map(
      (digit) =>
        `<td class="digit" width="52" height="64" align="center" valign="middle" style="width:52px;height:64px;border:1px solid ${boxBorder};border-radius:14px;background:${boxFill};font-family:${font};font-size:30px;line-height:30px;font-weight:600;color:${ink};">${digit}</td>`,
    )
    .join(`<td class="gap" width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>`);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${subject}</title>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;600&display=swap" rel="stylesheet">
<style>${styles}
</style>
</head>
<body class="page" style="margin:0;padding:0;background:${page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preview}${"&#8199;&#65279;&#847; ".repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="page" style="background:${page};">
  <tr>
    <td align="center" style="padding:56px 16px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td align="center" style="padding:0 0 22px;">
            <!-- The logo images have 10px/12px of padding built in; the negative top margin keeps the logo where it would be without it. -->
            <img src="cid:${LOGO_CID}" width="164" height="48" alt="buildinio" class="logo-light" style="display:block;border:0;outline:none;width:164px;height:48px;margin:-10px auto 0;">
            <!--[if !mso]><!-->
            <img src="cid:${LOGO_DARK_CID}" width="164" height="48" alt="buildinio" class="logo-dark" style="display:none;border:0;outline:none;width:164px;height:48px;margin:-10px auto 0;mso-hide:all;">
            <!--<![endif]-->
          </td>
        </tr>
        <tr>
          <td align="center" class="card" style="background:#ffffff;border-radius:24px;padding:48px 40px;font-family:${font};">
            <h1 class="ink" style="margin:0;font-size:26px;line-height:34px;font-weight:600;letter-spacing:-0.4px;color:${ink};">Confirm your email</h1>
            <p class="muted" style="margin:12px auto 0;max-width:380px;font-size:15px;line-height:24px;color:${muted};">Type these six digits into buildinio. The code expires in ${minutes}&nbsp;minutes.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:36px auto 0;">
              <tr>${digits}</tr>
            </table>
            <p class="muted" style="margin:36px auto 0;max-width:380px;font-size:14px;line-height:22px;color:${muted};">If you didn&rsquo;t try to sign in, ignore this email. Your account stays safe.</p>
          </td>
        </tr>
        <tr>
          <td align="center" class="muted" style="padding:28px 16px 0;font-family:${font};font-size:13px;line-height:20px;color:${faint};">
            You got this email because this address was entered on ${site}.<br>
            buildinio &middot; Build an app by describing it.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    "Confirm your email",
    "",
    `Type these six digits into buildinio. The code expires in ${minutes} minutes.`,
    "",
    `    ${code}`,
    "",
    "If you didn't try to sign in, ignore this email. Your account stays safe.",
    "",
    "—",
    siteUrl ? `buildinio · ${siteUrl}` : "buildinio",
  ].join("\n");

  return { subject, html, text };
}

function escape(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
