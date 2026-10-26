// The email with a sign-in code. Built with tables and inline styles, since
// that's what email apps (Gmail, Outlook, Apple Mail) render reliably.

// Brand colors (see brand/README.md), as plain hex: some email apps drop rgb() with alpha.
const ink = "#1c1c1f";
const body = "#3f3f46";
const muted = "#6b6b73";
const page = "#fafaf9";
const line = "#e8e8e9";
const codeBg = "#f4f4f5";
const font =
  "Onest, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const mono = "'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

/**
 * Content ids of the logos, attached inline so they show without hosting them anywhere.
 * The light one sits on a white badge: invisible on the white card, but it keeps the
 * logo readable in apps that force dark mode by darkening everything except images
 * (like Gmail's phone app). Apps that support dark-mode CSS get the white logo instead.
 */
export const LOGO_CID = "logo";
export const LOGO_DARK_CID = "logo-dark";

// Dark mode, for apps that support it (Apple Mail, iOS Mail, Outlook).
// [data-ogsc] is how Outlook.com and the Outlook apps mark their dark mode.
const darkStyles = `
@media (prefers-color-scheme: dark) {
  .page { background: #111113 !important; }
  .card { background: #1c1c1f !important; border-color: #2e2e33 !important; }
  .ink { color: #ffffff !important; }
  .body { color: #d4d4d8 !important; }
  .muted, .muted a { color: #a1a1aa !important; }
  .code { background: #27272a !important; color: #ffffff !important; }
  .logo-light { display: none !important; }
  .logo-dark { display: block !important; }
}
[data-ogsc] .ink { color: #ffffff !important; }
[data-ogsc] .body { color: #d4d4d8 !important; }
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
    ? `<a href="${escape(siteUrl)}" style="color:${muted};text-decoration:underline;">buildinio</a>`
    : "buildinio";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${subject}</title>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;600&display=swap" rel="stylesheet">
<style>
:root { color-scheme: light dark; supported-color-schemes: light dark; }${darkStyles}
</style>
</head>
<body class="page" style="margin:0;padding:0;background:${page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preview}${"&#8199;&#65279;&#847; ".repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="page" style="background:${page};">
  <tr>
    <td align="center" style="padding:48px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
        <tr>
          <td class="card" style="background:#ffffff;border:1px solid ${line};border-radius:16px;padding:30px 36px 40px;font-family:${font};">
            <!-- The logo images have 12px of padding built in; the negative margin lines the ink up with the text. -->
            <img src="cid:${LOGO_CID}" width="164" height="48" alt="buildinio" class="logo-light" style="display:block;border:0;outline:none;width:164px;height:48px;margin:0 0 22px -12px;">
            <!--[if !mso]><!-->
            <img src="cid:${LOGO_DARK_CID}" width="164" height="48" alt="buildinio" class="logo-dark" style="display:none;border:0;outline:none;width:164px;height:48px;margin:0 0 22px -12px;mso-hide:all;">
            <!--<![endif]-->
            <h1 class="ink" style="margin:0 0 12px;font-size:24px;line-height:32px;font-weight:600;letter-spacing:-0.4px;color:${ink};">Your verification code</h1>
            <p class="body" style="margin:0 0 28px;font-size:15px;line-height:24px;color:${body};">Enter this code on buildinio to continue. It expires in ${minutes}&nbsp;minutes.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <!-- The extra 10px on the left balances the letter-spacing after the last digit. -->
                <td align="center" class="code" style="background:${codeBg};border-radius:12px;padding:22px 12px 22px 22px;font-family:${mono};font-size:36px;line-height:40px;font-weight:600;letter-spacing:10px;color:${ink};">${code}</td>
              </tr>
            </table>
            <p class="muted" style="margin:28px 0 0;font-size:14px;line-height:22px;color:${muted};">If you didn&rsquo;t ask for this code, you can safely ignore this email. Someone may have typed your address by mistake.</p>
          </td>
        </tr>
        <tr>
          <td class="muted" style="padding:24px 4px 0;font-family:${font};font-size:13px;line-height:20px;color:${muted};">
            ${site} &middot; Build an app by describing it.<br>
            You got this email because someone entered this address to sign in.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    "Your buildinio verification code",
    "",
    `Enter this code on buildinio to continue. It expires in ${minutes} minutes.`,
    "",
    `    ${code}`,
    "",
    "If you didn't ask for this code, you can safely ignore this email.",
    "Someone may have typed your address by mistake.",
    "",
    "—",
    siteUrl ? `buildinio · ${siteUrl}` : "buildinio",
  ].join("\n");

  return { subject, html, text };
}

function escape(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
