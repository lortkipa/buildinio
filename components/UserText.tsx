import type { ReactNode } from "react";
import { focusRing } from "@/components/styles";
import { parseBlocks } from "@/lib/lists";
import type { ListBlock } from "@/lib/lists";

// Web addresses, and what usually ends a sentence after one rather than being part of it.
const URL = /https?:\/\/[^\s<>]+/g;
const TRAILING = /[.,;:!?'")\]]+$/;

/** Text as typed, with its web addresses as links (in a new tab). */
function Linked({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL)) {
    const href = match[0].replace(TRAILING, "");
    parts.push(text.slice(last, match.index));
    parts.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noreferrer"
        className={`rounded-sm underline decoration-foreground/30 underline-offset-[3px] transition-colors hover:decoration-foreground ${focusRing}`}
      >
        {href}
      </a>,
    );
    last = match.index + href.length;
  }
  parts.push(text.slice(last));
  return parts;
}

// Bullets go disc, circle, square as they nest, like in a document.
const LIST = "flex flex-col gap-0.5 pl-5 marker:text-foreground/50 [&_ol]:mt-0.5 [&_ul]:mt-0.5";
const BULLETS = "list-disc [&_ul]:list-[circle] [&_ul_ul]:list-[square]";

function List({ list }: { list: ListBlock }) {
  const items = list.items.map((item, index) => (
    <li key={index} className="pl-0.5">
      <Linked text={item.text} />
      {item.lists.map((inner, i) => (
        <List key={i} list={inner} />
      ))}
    </li>
  ));
  return list.ordered ? (
    <ol start={list.start} className={`${LIST} list-decimal marker:tabular-nums`}>
      {items}
    </ol>
  ) : (
    <ul className={`${LIST} ${BULLETS}`}>{items}</ul>
  );
}

/**
 * What someone typed, as they typed it (line breaks and all), except that bullets
 * and numbers show as real lists and web addresses as links.
 */
export function UserText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 whitespace-pre-wrap">
      {parseBlocks(text).map((block, index) =>
        block.kind === "text" ? (
          <p key={index}>
            <Linked text={block.text} />
          </p>
        ) : (
          <List key={index} list={block.list} />
        ),
      )}
    </div>
  );
}
