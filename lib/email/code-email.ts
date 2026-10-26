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

/** Content id of the logo, attached inline so it shows without hosting it anywhere. */
export const LOGO_CID = "logo";

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
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${subject}</title>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preview}${"&#8199;&#65279;&#847; ".repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${page};">
  <tr>
    <td align="center" style="padding:48px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
        <tr>
          <td style="padding:0 4px 28px;">
            <img src="cid:${LOGO_CID}" width="140" height="28" alt="buildinio" style="display:block;border:0;outline:none;width:140px;height:28px;">
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;border:1px solid ${line};border-radius:16px;padding:40px 36px;font-family:${font};">
            <h1 style="margin:0 0 12px;font-size:24px;line-height:32px;font-weight:600;letter-spacing:-0.4px;color:${ink};">Your verification code</h1>
            <p style="margin:0 0 28px;font-size:15px;line-height:24px;color:${body};">Enter this code on buildinio to continue. It expires in ${minutes}&nbsp;minutes.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <!-- The extra 10px on the left balances the letter-spacing after the last digit. -->
                <td align="center" style="background:${codeBg};border-radius:12px;padding:22px 12px 22px 22px;font-family:${mono};font-size:36px;line-height:40px;font-weight:600;letter-spacing:10px;color:${ink};">${code}</td>
              </tr>
            </table>
            <p style="margin:28px 0 0;font-size:14px;line-height:22px;color:${muted};">If you didn&rsquo;t ask for this code, you can safely ignore this email. Someone may have typed your address by mistake.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 4px 0;font-family:${font};font-size:13px;line-height:20px;color:${muted};">
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
