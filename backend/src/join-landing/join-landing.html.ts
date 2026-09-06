/**
 * The join landing page, as a string (W4-A).
 *
 * Hard requirements from the design, and every one of them is about the person
 * receiving the link — a farm worker, on a cheap Android phone, on a rural
 * connection, tapping a WhatsApp message:
 *
 *  • **Works with JavaScript off.** There is none. It is one HTML document.
 *  • **Works on a slow connection.** No fonts, no images, no CSS file, no
 *    analytics — one request, a few KB, inline styles.
 *  • **The code is the payload.** It is the biggest thing on the page and it
 *    is selectable text, because the fallback that always works is reading it
 *    out or copying it into the app by hand.
 *
 * Everything here is escaped. The farm name comes from the database and the
 * code comes from the URL; neither may become markup.
 */
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.upcheck.app';

/** HTML-escape. The code is already `[A-Z0-9]{8}`; the farm name is not. */
const esc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] as string,
  );

export function renderJoinPage(opts: {
  code: string;
  /** null for any code that is not currently usable — see the controller. */
  farmName: string | null;
}): string {
  const code = esc(opts.code);
  const named = opts.farmName !== null;
  const heading = named
    ? `You have been invited to join ${esc(opts.farmName!)}`
    : 'Join a farm on Neerani';
  // Deliberately does NOT say the code is wrong. This page cannot tell an
  // expired code from one that never existed without becoming an enumerator,
  // and telling a farmer their code is bad when the real problem is that it
  // expired sends them to retype it forever — the same mistake the join screen
  // in the app had.
  const lead = named
    ? 'Install Neerani, sign in, and enter this code when it asks you to join a farm.'
    : 'Install Neerani and enter your invite code when it asks you to join a farm. If the code below does not work, ask the farm owner for a new one.';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${named ? esc(opts.farmName!) + ' — ' : ''}Join on Neerani</title>
<meta name="robots" content="noindex">
<meta name="description" content="Join a farm on Neerani with your invite code.">
</head>
<body style="margin:0;background:#F6F8F7;color:#12241C;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;line-height:1.5">
<main style="max-width:30rem;margin:0 auto;padding:2rem 1.25rem">
  <p style="margin:0 0 1.5rem;font-size:.875rem;letter-spacing:.08em;text-transform:uppercase;color:#4B6157">Neerani</p>
  <h1 style="margin:0 0 .75rem;font-size:1.5rem;line-height:1.3">${heading}</h1>
  <p style="margin:0 0 1.5rem;color:#4B6157">${lead}</p>

  <p style="margin:0 0 .5rem;font-size:.875rem;color:#4B6157">Your invite code</p>
  <p style="margin:0 0 1.75rem;font-size:2rem;font-weight:700;letter-spacing:.15em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#fff;border:1px solid #D8E2DD;border-radius:.75rem;padding:1rem;text-align:center;word-break:break-all">${code}</p>

  <p style="margin:0 0 2rem">
    <a href="${PLAY_STORE_URL}"
       style="display:block;background:#12241C;color:#fff;text-decoration:none;text-align:center;padding:.9rem 1rem;border-radius:.75rem;font-weight:600">Get Neerani on Google Play</a>
  </p>

  <p style="margin:0;font-size:.875rem;color:#4B6157">Already have the app? Open it, go to Join a farm, and type the code above.</p>
</main>
</body>
</html>`;
}
