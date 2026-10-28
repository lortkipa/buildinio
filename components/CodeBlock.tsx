"use client";

import { memo } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { common, createLowlight } from "lowlight";
import clojure from "highlight.js/lib/languages/clojure";
import dart from "highlight.js/lib/languages/dart";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import dos from "highlight.js/lib/languages/dos";
import elixir from "highlight.js/lib/languages/elixir";
import erlang from "highlight.js/lib/languages/erlang";
import fsharp from "highlight.js/lib/languages/fsharp";
import groovy from "highlight.js/lib/languages/groovy";
import haskell from "highlight.js/lib/languages/haskell";
import http from "highlight.js/lib/languages/http";
import julia from "highlight.js/lib/languages/julia";
import latex from "highlight.js/lib/languages/latex";
import matlab from "highlight.js/lib/languages/matlab";
import nginx from "highlight.js/lib/languages/nginx";
import nix from "highlight.js/lib/languages/nix";
import ocaml from "highlight.js/lib/languages/ocaml";
import pgsql from "highlight.js/lib/languages/pgsql";
import powershell from "highlight.js/lib/languages/powershell";
import protobuf from "highlight.js/lib/languages/protobuf";
import scala from "highlight.js/lib/languages/scala";
import vim from "highlight.js/lib/languages/vim";
import { CopyButton } from "@/components/MessageActions";

// highlight.js's common languages and some more, without the hundreds nobody asks about.
const lowlight = createLowlight({
  ...common,
  clojure,
  dart,
  dockerfile,
  dos,
  elixir,
  erlang,
  fsharp,
  groovy,
  haskell,
  http,
  julia,
  latex,
  matlab,
  nginx,
  nix,
  ocaml,
  pgsql,
  powershell,
  protobuf,
  scala,
  vim,
});
lowlight.registerAlias({
  bash: ["zsh", "console", "terminal"],
  ini: ["toml", "env", "dotenv"],
  json: ["jsonc", "json5"],
  xml: ["vue", "svelte", "astro"],
});

// What the label over a block says, for names that aren't just the language capitalized.
const LABELS: Record<string, string> = {
  bash: "Bash", sh: "Shell", shell: "Shell", zsh: "Zsh", console: "Terminal", terminal: "Terminal",
  c: "C", cpp: "C++", "c++": "C++", cs: "C#", csharp: "C#", fsharp: "F#", objectivec: "Objective-C", objc: "Objective-C",
  css: "CSS", scss: "SCSS", less: "Less", html: "HTML", xml: "XML", svg: "SVG", vue: "Vue", svelte: "Svelte", astro: "Astro",
  js: "JavaScript", javascript: "JavaScript", mjs: "JavaScript", cjs: "JavaScript", jsx: "JSX",
  ts: "TypeScript", typescript: "TypeScript", tsx: "TSX",
  json: "JSON", jsonc: "JSON", json5: "JSON5", yaml: "YAML", yml: "YAML", toml: "TOML", ini: "INI", env: ".env", dotenv: ".env",
  py: "Python", python: "Python", rb: "Ruby", ruby: "Ruby", rs: "Rust", rust: "Rust", go: "Go", golang: "Go",
  kt: "Kotlin", kotlin: "Kotlin", java: "Java", swift: "Swift", php: "PHP", sql: "SQL", pgsql: "PostgreSQL", postgres: "PostgreSQL",
  graphql: "GraphQL", gql: "GraphQL", md: "Markdown", markdown: "Markdown", diff: "Diff", patch: "Diff",
  dockerfile: "Dockerfile", docker: "Dockerfile", makefile: "Makefile", make: "Makefile", ps1: "PowerShell", powershell: "PowerShell",
  bat: "Batch", cmd: "Batch", dos: "Batch", latex: "LaTeX", tex: "LaTeX", http: "HTTP", nginx: "Nginx", proto: "Protobuf",
  protobuf: "Protobuf", r: "R", lua: "Lua", perl: "Perl", dart: "Dart", scala: "Scala", haskell: "Haskell", hs: "Haskell",
  elixir: "Elixir", ex: "Elixir", erlang: "Erlang", clojure: "Clojure", clj: "Clojure", julia: "Julia", ocaml: "OCaml",
  matlab: "MATLAB", groovy: "Groovy", nix: "Nix", vim: "Vim script", wasm: "WebAssembly", vbnet: "VB.NET", arduino: "Arduino",
  text: "Text", txt: "Text", plaintext: "Text",
};

/**
 * A fenced code block in an answer: the language and a copy button over the code,
 * colored by its language when it's one we know. Long lines scroll sideways.
 * Memoized, so blocks above the part that's streaming in aren't highlighted again.
 */
export const CodeBlock = memo(function CodeBlock({ code, language }: { code: string; language?: string }) {
  const name = language?.toLowerCase();
  const known = name !== undefined && lowlight.registered(name);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-code">
      <div className="flex h-10 items-center justify-between border-b border-border pr-1 pl-4">
        <span className="text-xs font-medium text-muted">{(name && LABELS[name]) ?? language ?? "Code"}</span>
        <CopyButton text={code} label="Copy code" />
      </div>
      {/* data-scroll-x: a swipe here scrolls the code instead of pulling in the preview. */}
      <pre data-scroll-x className="scrollbar-thin overflow-x-auto px-4 py-3.5 font-mono text-[0.8125rem] leading-6">
        <code className="hljs">
          {known ? toJsxRuntime(lowlight.highlight(name, code), { Fragment, jsx, jsxs }) : code}
        </code>
      </pre>
    </div>
  );
});
