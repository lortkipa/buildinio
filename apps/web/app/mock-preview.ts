import { FIRST_VERSION } from "./mock-projects";
import { PROJECT_COLORS, type ProjectColor } from "./project-icon";

/*
 * The app a project's preview shows (preview-panel.tsx) until generating apps is built: one small
 * site per project, in its name and color, with the prompt that started it as the tagline. It has a
 * few pages, so the route field, the links and the device views can all be tried.
 *
 * It runs in a sandboxed iframe, like the real preview will, and talks to the panel the same way:
 * it posts { type: "route", path } when it loads and on every page change, and goes to the page in
 * { type: "navigate", path }. Its own router keeps the page in memory, since a sandboxed srcdoc
 * frame can't use history.pushState.
 */

// The name and prompt are the user's text, so they are escaped.
function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// A value for a script: JSON, with "<" escaped so the text can't close the script tag.
const scriptValue = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

export function mockPreviewDocument({
  name,
  color,
  tagline,
  route,
}: {
  name: string;
  color: ProjectColor;
  tagline: string;
  // The page to open on, e.g. the one shown before a rename rebuilt the document.
  route: string;
}) {
  const title = escapeHtml(name);
  const features = FIRST_VERSION.map(
    (feature) => `<li class="card"><span class="mark"></span>${escapeHtml(feature)}</li>`,
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
:root {
  color-scheme: light dark;
  --accent: ${PROJECT_COLORS[color]};
  /* Dark enough for white text, whatever the color. */
  --accent-strong: oklch(from var(--accent) min(l, 0.55) c h);
  --bg: #ffffff;
  --text: #18181b;
  --muted: #52525b;
  --card: #f7f7f8;
  --line: rgb(24 24 27 / 0.1);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0c0c12;
    --text: #fafafa;
    --muted: #a1a1aa;
    --card: #16161d;
    --line: rgb(255 255 255 / 0.1);
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scrollbar-width: thin; }
body {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; }
header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1.5rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--line);
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  font-weight: 700;
  text-decoration: none;
}
.logo {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.55rem;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
}
nav { display: flex; gap: 0.25rem; }
nav a {
  padding: 0.35rem 0.8rem;
  border-radius: 999px;
  color: var(--muted);
  font-size: 0.9rem;
  text-decoration: none;
}
nav a:hover { color: var(--text); }
nav a[aria-current="page"] {
  color: var(--text);
  background: color-mix(in oklab, var(--accent) 18%, transparent);
}
main { flex: 1; width: 100%; max-width: 64rem; margin: 0 auto; padding: 4.5rem 1.5rem; }
.eyebrow {
  color: var(--accent-strong);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
@media (prefers-color-scheme: dark) {
  .eyebrow { color: oklch(from var(--accent) max(l, 0.75) c h); }
}
h1 {
  margin-top: 0.75rem;
  font-size: clamp(2.25rem, 7vw, 4rem);
  line-height: 1.05;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}
h2 { font-size: clamp(1.75rem, 5vw, 2.5rem); line-height: 1.15; letter-spacing: -0.02em; }
.lead { max-width: 38rem; margin-top: 1.25rem; color: var(--muted); font-size: 1.15rem; overflow-wrap: anywhere; }
.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 2.25rem; }
.button {
  padding: 0.75rem 1.4rem;
  border-radius: 999px;
  background: var(--accent-strong);
  color: #fff;
  font-weight: 600;
  text-decoration: none;
}
.button.secondary { background: transparent; color: var(--text); box-shadow: inset 0 0 0 1px var(--line); }
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-top: 2.5rem;
  list-style: none;
}
.card {
  padding: 1.25rem;
  border: 1px solid var(--line);
  border-radius: 1rem;
  background: var(--card);
}
.mark {
  display: block;
  width: 2.25rem;
  height: 2.25rem;
  margin-bottom: 0.9rem;
  border-radius: 0.7rem;
  background: color-mix(in oklab, var(--accent) 24%, transparent);
}
.prose { max-width: 38rem; margin-top: 1.25rem; color: var(--muted); }
.prose + .prose { margin-top: 1rem; }
code {
  padding: 0.1rem 0.4rem;
  border-radius: 0.4rem;
  background: var(--card);
  font: 0.9em ui-monospace, monospace;
  overflow-wrap: anywhere;
}
footer {
  padding: 1.5rem;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 0.85rem;
  text-align: center;
}
[hidden] { display: none !important; }
@media (max-width: 720px) {
  header { padding: 0.875rem 1.25rem; }
  main { padding: 3rem 1.25rem; }
  .grid { grid-template-columns: 1fr; }
}
</style>
</head>
<body>
<header>
  <a class="brand" href="/" data-to="/"><span class="logo"></span><span>${title}</span></a>
  <nav>
    <a href="/" data-to="/">Home</a>
    <a href="/features" data-to="/features">Features</a>
    <a href="/about" data-to="/about">About</a>
  </nav>
</header>
<main>
  <section data-page="/">
    <p class="eyebrow">Welcome</p>
    <h1>${title}</h1>
    <p class="lead">${escapeHtml(tagline)}</p>
    <div class="actions">
      <a class="button" href="/features" data-to="/features">See what’s inside</a>
      <a class="button secondary" href="/about" data-to="/about">About</a>
    </div>
  </section>
  <section data-page="/features" hidden>
    <p class="eyebrow">Features</p>
    <h2>Everything in the first version</h2>
    <ul class="grid">${features}</ul>
  </section>
  <section data-page="/about" hidden>
    <p class="eyebrow">About</p>
    <h2>Made from one sentence</h2>
    <p class="prose">${title} started as a single description: “${escapeHtml(tagline)}”</p>
    <p class="prose">This is its first version. It changes with every message in the chat.</p>
  </section>
  <section data-missing hidden>
    <p class="eyebrow">404</p>
    <h2>Page not found</h2>
    <p class="prose">There’s no page at <code id="missing-path"></code>.</p>
    <div class="actions"><a class="button" href="/" data-to="/">Back home</a></div>
  </section>
</main>
<footer>Made with Buildinio</footer>
<script>
  const pages = document.querySelectorAll("[data-page]");
  const missing = document.querySelector("[data-missing]");
  const navLinks = document.querySelectorAll("nav a");
  const appName = ${scriptValue(name)};

  function show(path) {
    // Pages match without the query or hash.
    const page = path.split(/[?#]/)[0];
    let found = false;
    for (const section of pages) {
      const match = section.dataset.page === page;
      section.hidden = !match;
      if (match) found = true;
    }
    missing.hidden = found;
    if (!found) document.getElementById("missing-path").textContent = page;
    for (const link of navLinks) {
      if (link.dataset.to === page) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    document.title = found ? appName : "Page not found · " + appName;
    window.scrollTo(0, 0);
    parent.postMessage({ type: "route", path }, "*");
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-to]");
    if (!link) return;
    event.preventDefault();
    show(link.dataset.to);
  });

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (event.source !== parent || !data || data.type !== "navigate") return;
    if (typeof data.path === "string") show(data.path);
  });

  show(${scriptValue(route)});
</script>
</body>
</html>`;
}
