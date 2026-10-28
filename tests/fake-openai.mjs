// A stand-in for OpenAI's Responses API, for the Playwright tests (see playwright.config.ts).
// The app talks to it like to OpenAI (OPENAI_BASE_URL), so the real code runs end to end:
// - naming (a json_schema request) gets a fixed name;
// - a prompt with a "?" just gets an answer;
// - a prompt with "React" gets the template's src/App.tsx rewritten, for a real Vite build
//   (npm install needs the network; the tests don't use it);
// - any other prompt gets a short plan and file writes for a page with a tiny build script
//   (no npm install needed), then a summary once the files are written.

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
    const text = JSON.stringify({ name: "Test Kitchen", icon: "utensils", color: "orange" });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(completed(nextId("resp"), [message(text)])));
    return;
  }

  response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  const send = (event) => response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  const id = nextId("resp");
  send({ type: "response.created", response: { id, status: "in_progress", output: [] } });

  const prompt = [...(Array.isArray(body.input) ? body.input : [])].reverse().find((item) => item.role === "user")?.content ?? "";
  const output = [];
  if (body.previous_response_id) {
    output.push(streamText(send, "**Test Kitchen** is ready. Take a look, and tell me what to change."));
  } else if (String(prompt).includes("?")) {
    await wait(300);
    output.push(streamText(send, "Good question. I can build websites and apps from a description."));
  } else {
    await wait(DELAY_MS);
    output.push(streamText(send, "I'll make a simple test page."));
    for (const [path, content] of Object.entries(String(prompt).includes("React") ? REACT_FILES : FILES)) {
      const item = {
        type: "function_call",
        id: nextId("fc"),
        call_id: nextId("call"),
        name: "write_file",
        arguments: JSON.stringify({ path, content }),
        status: "completed",
      };
      send({ type: "response.output_item.added", output_index: output.length, item });
      send({ type: "response.output_item.done", output_index: output.length, item });
      output.push(item);
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
  return { id, object: "response", status: "completed", output };
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
