// A stand-in for OpenAI's Responses API, for the Playwright tests (see playwright.config.ts).
// The app talks to it like to OpenAI (OPENAI_BASE_URL), so the real code runs end to end:
// - naming (a json_schema request) gets a fixed name;
// - a prompt with "Markdown" just gets tests/markdown-sample.md as its answer;
// - a prompt with a "?" just gets an answer;
// - a prompt with "React" gets the template's src/App.tsx rewritten, for a real Vite build
//   (npm install needs the network; the tests don't use it);
// - a prompt with "design" reads the frontend-design skill too, and says so once it has;
// - a prompt with "look" looks at the app too (real screenshots), and says so once it got them;
// - any other prompt gets a short plan and file writes for a page with a tiny build script
//   (no npm install needed), then a summary once the files are written.
// Every request has to be cacheable like OpenAI's prompt cache wants it: a prompt_cache_key,
// and the same instructions from one request to the next. If not, the answer says so.

import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_OPENAI_PORT || 3101);
const DELAY_MS = Number(process.env.FAKE_OPENAI_DELAY_MS ?? 1500); // Before building, so tests see the skeleton.

const PAGE_HEADING = "Built by the test AI";

const FILES = {
  "package.json": JSON.stringify({ name: "app", private: true, scripts: { build: "node build.mjs" } }, null, 2),
  "build.mjs": `import { copyFileSync, mkdirSync } from "node:fs";\nmkdirSync("dist", { recursive: true });\ncopyFileSync("page.html", "dist/index.html");\n`,
  "page.html": `<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Test app</title></head>\n<body>\n<h1>${PAGE_HEADING}</h1>\n</body>\n</html>\n`,
};

// A small React page for the real template, with Tailwind classes.
const REACT_FILES = {
  "src/App.tsx": `export default function App() {
  return (
    <main className="min-h-dvh bg-orange-50 px-6 py-16 text-center text-stone-900">
      <p className="text-sm font-semibold tracking-wide text-orange-600 uppercase">Test Kitchen</p>
      <h1 className="mt-3 text-4xl font-bold">Recipes worth repeating</h1>
      <p className="mx-auto mt-4 max-w-md text-stone-600">Built with React and Tailwind by the test AI.</p>
      <button className="mt-8 rounded-full bg-orange-500 px-6 py-3 font-medium text-white">Browse recipes</button>
    </main>
  );
}
`,
};

const MARKDOWN = readFileSync(new URL("./markdown-sample.md", import.meta.url), "utf8");

const SKILL_HEADING = "# Frontend Design"; // In skills/frontend-design/SKILL.md.

const instructionsOf = new Map(); // By response id: the instructions it was made with.
let count = 0;
const nextId = (prefix) => `${prefix}_${++count}`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

createServer(async (request, response) => {
  if (request.method !== "POST" || !request.url?.endsWith("/responses")) {
    response.writeHead(404).end();
    return;
  }
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw);

  if (body.text?.format?.type === "json_schema") {
    if (String(body.input).includes("project color only")) await wait(2500);
    const text = JSON.stringify({ name: "Test Kitchen", icon: "utensils", color: "orange" });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(completed(nextId("resp"), [message(text)])));
    return;
  }

  response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  const send = (event) => response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  const id = nextId("resp");
  send({ type: "response.created", response: { id, status: "in_progress", output: [] } });

  const input = Array.isArray(body.input) ? body.input : [];
  const prompt = [...input].reverse().find((item) => item.role === "user")?.content ?? "";
  const output = [];
  const uncacheable = cacheProblem(body);
  instructionsOf.set(id, body.instructions);
  if (uncacheable) {
    output.push(streamText(send, uncacheable));
  } else if (body.previous_response_id) {
    const results = input.filter((item) => item.type === "function_call_output").map((item) => item.output);
    if (results.some((result) => String(result).startsWith("Updated project:"))) await wait(2000);
    const designed = results.some((result) => String(result).includes(SKILL_HEADING)) ? ", designed with the guide" : "";
    const pictures = results.flatMap((result) => (Array.isArray(result) ? result : [])).filter(isScreenshot);
    const looked = pictures.length === 2 ? ", and I checked how it looks" : "";
    output.push(streamText(send, `**Test Kitchen** is ready${designed}${looked}. Take a look, and tell me what to change.`));
  } else if (String(prompt).includes("project settings") || String(prompt).includes("project color only")) {
    await wait(DELAY_MS);
    output.push(streamText(send, "I'll update your project settings."));
    const invalid = String(prompt).includes("invalid");
    const calls = String(prompt).includes("project color only")
      ? [["set_project_color", { color: "violet" }]]
      : String(prompt).includes("name only")
        ? [["rename_project", { name: "  Moon   Garden  " }]]
        : [
            ["rename_project", { name: invalid ? "x".repeat(61) : "  Moon   Garden  " }],
            ["set_project_icon", { icon: invalid ? "missing" : "leaf" }],
            ["set_project_color", { color: invalid ? "missing" : "violet" }],
          ];
    for (const [name, args] of calls) output.push(streamCall(send, name, args, output.length));
  } else if (String(prompt).includes("Markdown")) {
    output.push(streamText(send, MARKDOWN));
  } else if (String(prompt).includes("?")) {
    await wait(300);
    output.push(streamText(send, "Good question. I can build websites and apps from a description."));
  } else {
    await wait(DELAY_MS);
    output.push(streamText(send, "I'll make a simple test page."));
    const calls = Object.entries(String(prompt).includes("React") ? REACT_FILES : FILES).map(([path, content]) => [
      "write_file",
      { path, content },
    ]);
    if (String(prompt).includes("design")) calls.unshift(["load_skill", { name: "frontend-design", file: "" }]);
    if (String(prompt).includes("look")) calls.push(["look_at_app", { page: "/" }]); // "/" is the start page too.
    for (const [name, args] of calls) {
      output.push(streamCall(send, name, args, output.length));
    }
  }
  send({ type: "response.completed", response: completed(id, output) });
  response.end();
}).listen(PORT, () => console.log(`Fake OpenAI on http://localhost:${PORT}`));

function message(text) {
  return {
    type: "message",
    id: nextId("msg"),
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text, annotations: [] }],
  };
}

function completed(id, output) {
  const usage = {
    input_tokens: 2000,
    input_tokens_details: { cached_tokens: 1800 },
    output_tokens: 100,
    output_tokens_details: { reasoning_tokens: 40 },
    total_tokens: 2100,
  };
  return { id, object: "response", status: "completed", output, usage };
}

/** A PNG screenshot, as look_at_app sends them. */
function isScreenshot(part) {
  return part?.type === "input_image" && String(part.image_url).startsWith("data:image/png;base64,iVBOR");
}

/** Why OpenAI couldn't reuse the cached prompt for this request, or null if it could. */
function cacheProblem(body) {
  if (!body.prompt_cache_key) return "The request had no prompt_cache_key.";
  if (String(body.instructions).includes("# This project")) return "The project's files were in the instructions.";
  const before = body.previous_response_id && instructionsOf.get(body.previous_response_id);
  if (before !== undefined && before !== body.instructions) return "The instructions changed between requests.";
  return null;
}

/** A message, streamed a few letters at a time. */
function streamText(send, text) {
  const item = message(text);
  send({ type: "response.output_item.added", output_index: 0, item: { ...item, content: [] } });
  for (let at = 0; at < text.length; at += 8) {
    send({ type: "response.output_text.delta", item_id: item.id, output_index: 0, content_index: 0, delta: text.slice(at, at + 8) });
  }
  send({ type: "response.output_item.done", output_index: 0, item });
  return item;
}

/** A completed function call, like OpenAI streams it. */
function streamCall(send, name, args, index) {
  const item = {
    type: "function_call",
    id: nextId("fc"),
    call_id: nextId("call"),
    name,
    arguments: JSON.stringify(args),
    status: "completed",
  };
  send({ type: "response.output_item.added", output_index: index, item });
  send({ type: "response.output_item.done", output_index: index, item });
  return item;
}
