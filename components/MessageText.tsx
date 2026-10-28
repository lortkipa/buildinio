"use client";

import type { ComponentProps } from "react";
import { Check } from "lucide-react";
import Markdown from "react-markdown";
import type { Components, ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/CodeBlock";
import { focusRing } from "@/components/styles";

/** An element's attributes, without the Markdown tree node react-markdown adds. */
function attrs<P extends ExtraProps>(props: P): Omit<P, "node"> {
  const { node: _node, ...rest } = props; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
}

/** A link out of the app, in a new tab. */
function Link(props: ComponentProps<"a"> & ExtraProps) {
  return (
    <a
      {...attrs(props)}
      target="_blank"
      rel="noreferrer"
      className={`rounded-sm font-medium underline decoration-foreground/30 underline-offset-[3px] transition-colors hover:decoration-foreground ${focusRing}`}
    />
  );
}

const heading = "mt-3 font-semibold tracking-tight text-foreground first:mt-0";
const list = "flex flex-col gap-1 marker:text-muted [&_ol]:mt-1 [&_ul]:mt-1";

// How each part of an answer looks. Blocks sit in a column with a gap between them.
const COMPONENTS: Components = {
  h1: (props) => <h1 {...attrs(props)} className={`${heading} text-2xl leading-snug`} />,
  h2: (props) => <h2 {...attrs(props)} className={`${heading} text-xl leading-snug ${props.className ?? ""}`} />,
  h3: (props) => <h3 {...attrs(props)} className={`${heading} text-lg`} />,
  h4: (props) => <h4 {...attrs(props)} className={`${heading} text-base`} />,
  h5: (props) => <h5 {...attrs(props)} className={`${heading} text-sm`} />,
  h6: (props) => <h6 {...attrs(props)} className={`${heading} text-sm text-muted`} />,
  strong: (props) => <strong {...attrs(props)} className="font-semibold" />,
  em: (props) => <em {...attrs(props)} className="italic" />,
  del: (props) => <del {...attrs(props)} className="text-muted line-through" />,
  a: Link,
  ul: (props) => (
    <ul
      {...attrs(props)}
      className={`${list} ${props.className?.includes("contains-task-list") ? "list-none pl-1" : "list-disc pl-6"}`}
    />
  ),
  ol: (props) => <ol {...attrs(props)} className={`${list} list-decimal pl-6 marker:tabular-nums`} />,
  li: (props) => (
    <li
      {...attrs(props)}
      className={`[&>p+*]:mt-2 ${props.className?.includes("task-list-item") ? "" : "pl-1"}`}
    />
  ),
  input: ({ checked }) => (
    // A task list's box: ticked or not, never clickable.
    <span
      role="checkbox"
      aria-checked={!!checked}
      aria-disabled
      className={`mr-2 inline-grid size-[1.125em] place-items-center rounded-[0.3em] border align-[-0.2em] ${
        checked ? "border-foreground bg-foreground text-background" : "border-foreground/30"
      }`}
    >
      {checked && <Check size={12} strokeWidth={3} aria-hidden />}
    </span>
  ),
  blockquote: (props) => (
    <blockquote {...attrs(props)} className="flex flex-col gap-2 border-l-2 border-foreground/20 pl-4 text-foreground/75" />
  ),
  hr: () => <hr className="my-1 border-border" />,
  code: (props) => (
    <code {...attrs(props)} className="rounded-md bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[0.875em]" />
  ),
  pre: ({ node }) => {
    const code = node?.children[0];
    if (code?.type !== "element") return null;
    const text = code.children.map((child) => (child.type === "text" ? child.value : "")).join("");
    const language = (code.properties.className as string[] | undefined)
      ?.find((name) => name.startsWith("language-"))
      ?.slice("language-".length);
    return <CodeBlock code={text.replace(/\n$/, "")} language={language} />;
  },
  table: (props) => (
    // data-scroll-x: a swipe here scrolls the table instead of pulling in the preview.
    <div data-scroll-x className="scrollbar-thin overflow-x-auto rounded-2xl border border-border">
      <table {...attrs(props)} className="w-full border-collapse text-left text-sm wrap-break-word" />
    </div>
  ),
  thead: (props) => <thead {...attrs(props)} className="bg-foreground/[0.04]" />,
  tbody: (props) => <tbody {...attrs(props)} className="[&>tr:nth-child(even)]:bg-foreground/[0.02]" />,
  tr: (props) => <tr {...attrs(props)} className="border-b border-border last:border-0" />,
  th: (props) => <th {...attrs(props)} className="px-4 py-2.5 font-semibold whitespace-nowrap" />,
  td: (props) => <td {...attrs(props)} className="min-w-32 px-4 py-2.5 align-top" />,
  // Pictures from anywhere could be broken or track who looks: a link to them instead.
  img: ({ src, alt }) => (typeof src === "string" ? <Link href={src}>{alt || src}</Link> : null),
};

/**
 * The AI's text, from Markdown: headings, paragraphs, **bold**, *italic*, lists
 * (with task boxes), quotes, links, tables and code, colored by its language.
 * `streaming` means it's halfway in, so a half-typed part (like the start of
 * **bold** or a table) shows as it will once the rest is there.
 */
export function MessageText({ text, streaming = false }: { text: string; streaming?: boolean }) {
  return (
    <div className="flex flex-col gap-3 leading-relaxed wrap-anywhere">
      <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {streaming ? settle(text) : text}
      </Markdown>
    </div>
  );
}

/**
 * Text that's still streaming in, tidied so it doesn't flash Markdown that hasn't
 * finished: a "-" that may be a list, a rule or a heading's underline; ** or `
 * with no end yet; a table with only its header row; a link without its address.
 */
function settle(text: string) {
  // Inside a code block, which runs to the end until it's closed: nothing to do.
  if ((text.match(/^ {0,3}(```|~~~)/gm)?.length ?? 0) % 2) return text;

  const lines = text.split("\n");
  let last = lines.pop() ?? "";
  // A line that's only just started could still become anything.
  if (/^\s*([-*+_=`~#>|]+|\d+[.)]?)\s*$/.test(last)) last = "";
  // A link that's still coming shows as its text.
  last = last.replace(/!?\[([^\]]*)\]\([^)]*$/, "$1").replace(/!?\[([^\]]*)$/, "$1");
  // Markers being typed at the very end, and any space before them (an ending marker can't follow one).
  last = last.replace(/[*`~]+$/, "").trimEnd();

  const before = lines.join("\n");
  const blockStart = before.lastIndexOf("\n\n");
  const block = (blockStart === -1 ? before : before.slice(blockStart + 2)) + (lines.length ? "\n" : "") + last;
  const head = blockStart === -1 ? "" : before.slice(0, blockStart + 2);

  // A table shows once its header and the line under it are both there.
  const rows = block.split("\n");
  if (rows[0]?.trimStart().startsWith("|") && !(rows[1] && cells(rows[1]) === cells(rows[0]) && /^[\s|:-]+$/.test(rows[1]))) {
    return head.trimEnd();
  }

  // Close what's still open, innermost first.
  const ticks = block.match(/`/g)?.length ?? 0;
  const plain = block.replace(/`[^`]*`/g, "").replace(/`[^`]*$/, "").replace(/\\[*~]/g, "");
  const bold = plain.match(/\*\*/g)?.length ?? 0;
  const italic = plain.replace(/\*\*/g, "").replace(/^\s*\*\s/gm, "").replace(/\s\*\s/g, " ").match(/\*/g)?.length ?? 0;
  const strike = plain.match(/~~/g)?.length ?? 0;
  const close = (ticks % 2 ? "`" : "") + (italic % 2 ? "*" : "") + (bold % 2 ? "**" : "") + (strike % 2 ? "~~" : "");
  return head + block + close;
}

/** How many cells a table row has. */
function cells(row: string) {
  return row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").length;
}
