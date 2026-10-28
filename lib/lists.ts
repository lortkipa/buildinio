/**
 * Lists in what people type: "•" bullets ("- " and "* " turn into one as you
 * type) and "1." numbers, nested by indenting. Plain text all the way: the AI
 * reads it as it is, and the chat shows it as real lists (`parseBlocks`).
 */

// A list item's start: its indent, a bullet or a number, and the space after it.
const ITEM = /^([ \t]*)(?:([•◦▪‣*+-])|(\d{1,9})([.)]))([ \t]+)/;

export type Item = {
  indent: number; // Characters before the marker.
  bullet: string | null;
  number: number | null;
  delim: string; // After a number: "." or ")".
  space: string;
  prefix: number; // Where the item's text starts.
};

/** The list item a line starts, if it starts one. */
export function parseItem(line: string): Item | null {
  const match = ITEM.exec(line);
  if (!match) return null;
  const [all, indent, bullet, number, delim, space] = match;
  return {
    indent: indent.length,
    bullet: bullet ?? null,
    number: number ? Number(number) : null,
    delim: delim ?? "",
    space,
    prefix: all.length,
  };
}

/** An item's start written out. */
function format(item: Item) {
  return " ".repeat(item.indent) + (item.number === null ? item.bullet : `${item.number}${item.delim}`) + item.space;
}

function indentOf(line: string) {
  return line.length - line.trimStart().length;
}

/** A line that carries on the item above it (indented, with no bullet of its own). */
function continues(line: string) {
  return /^[ \t]/.test(line) && !parseItem(line);
}

/** The item line `i` is part of: itself, or the item above it that it carries on. -1 if none. */
function owner(lines: string[], i: number) {
  if (parseItem(lines[i])) return i;
  if (!continues(lines[i])) return -1;
  const indent = indentOf(lines[i]);
  for (let j = i - 1; j >= 0; j--) {
    const item = parseItem(lines[j]);
    if (item) return item.indent < indent ? j : -1;
    if (!continues(lines[j])) return -1;
  }
  return -1;
}

/** The nearest item above line `i` in the same list that `match` accepts. */
function itemAbove(lines: string[], i: number, match: (item: Item) => boolean) {
  for (let j = i - 1; j >= 0; j--) {
    const item = parseItem(lines[j]);
    if (item && match(item)) return item;
    if (!item && !continues(lines[j])) return null;
  }
  return null;
}

/**
 * Numbers a block's numbered lists 1, 2, 3… again, each from its first item's number,
 * after an edit to line `at`. Only numbers change, so what's after them stays put.
 */
function renumber(lines: string[], at: number) {
  let start = Math.min(at, lines.length - 1);
  while (start > 0 && lines[start - 1].trim()) start--;
  const levels: { indent: number; number: number | null }[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      if (i > at) break;
      levels.length = 0;
      continue;
    }
    const item = parseItem(line);
    if (!item) {
      if (!continues(line)) levels.length = 0;
      continue;
    }
    while (levels.length && levels[levels.length - 1].indent > item.indent) levels.pop();
    const top = levels[levels.length - 1];
    const sibling = top?.indent === item.indent ? top : undefined;
    if (item.number !== null && sibling?.number != null && item.number !== sibling.number + 1) {
      lines[i] = format({ ...item, number: sibling.number + 1 }) + line.slice(item.prefix);
      item.number = sibling.number + 1;
    }
    if (sibling) levels.pop();
    levels.push({ indent: item.indent, number: item.number });
  }
}

/** A place in the text, as a line and how far from that line's end (which a new number doesn't move). */
type Spot = { line: number; fromEnd: number };

function spotOf(lines: string[], position: number): Spot {
  let line = 0;
  while (line < lines.length - 1 && position > lines[line].length) position -= lines[line++].length + 1;
  return { line, fromEnd: lines[line].length - position };
}

function positionOf(lines: string[], { line, fromEnd }: Spot) {
  let position = 0;
  for (let i = 0; i < line; i++) position += lines[i].length + 1;
  return position + Math.max(0, lines[line].length - fromEnd);
}

/** What an edit leaves: the new text and where the selection goes. */
export type Edit = { value: string; start: number; end: number };

function finish(lines: string[], start: Spot, end: Spot, at: number): Edit {
  renumber(lines, at);
  return { value: lines.join("\n"), start: positionOf(lines, start), end: positionOf(lines, end) };
}

export type ListKey = "Enter" | "Tab" | "Shift+Tab" | "Backspace";

/**
 * What a key does in a list, or null when it does what it always does:
 * - Enter (and Shift+Enter, which people use for a new line) starts the next item,
 *   numbered one more. On an empty item it moves the item out a level, or ends the list.
 * - Tab and Shift+Tab move the item, its sub-items and the selected items in and out a level.
 * - Backspace just after a bullet or number takes it away.
 */
export function listKey(value: string, selStart: number, selEnd: number, key: ListKey): Edit | null {
  if (key === "Tab" || key === "Shift+Tab") return indent(value, selStart, selEnd, key === "Tab" ? 1 : -1);
  if (key === "Backspace") return selStart === selEnd ? removeMarker(value, selStart) : null;

  // Enter types over a selection, like any key.
  const lines = (value.slice(0, selStart) + value.slice(selEnd)).split("\n");
  const caret = spotOf(lines, selStart);
  const i = caret.line;
  const o = owner(lines, i);
  if (o === -1) return null;
  const item = parseItem(lines[o])!;
  const line = lines[i];

  const next = format({ ...item, number: item.number === null ? null : item.number + 1 });
  if (o === i && !line.slice(item.prefix).trim()) {
    // An empty item: out a level, or out of the list.
    if (item.indent > 0) return indent(lines.join("\n"), selStart, selStart, -1);
    lines[i] = "";
    const spot = { line: i, fromEnd: 0 };
    return finish(lines, spot, spot, i);
  }
  // On the bullet itself, the text moves down and an empty item stays above it.
  const col = Math.max(line.length - caret.fromEnd, o === i ? item.prefix : 0);
  const after = line.slice(col).trimStart();
  if (o !== i && !line.slice(0, col).trim()) {
    // On an empty line under the item: that line becomes the next item.
    lines[i] = next + after;
    const spot = { line: i, fromEnd: after.length };
    return finish(lines, spot, spot, i);
  }
  const keep = o === i ? item.prefix : 0; // The bullet stays even with no text after it.
  lines.splice(i, 1, line.slice(0, keep) + line.slice(keep, col).trimEnd(), next + after);
  const spot = { line: i + 1, fromEnd: after.length };
  return finish(lines, spot, spot, i);
}

/** Tab (`by` 1) and Shift+Tab (-1): the items in the selection, and what's under them, in or out a level. */
function indent(value: string, selStart: number, selEnd: number, by: 1 | -1): Edit | null {
  const lines = value.split("\n");
  const start = spotOf(lines, selStart);
  const end = spotOf(lines, selEnd);
  let last = end.line;
  // A selection that ends at the start of a line doesn't take that line.
  if (last > start.line && end.fromEnd === lines[last].length) last--;

  let first = owner(lines, start.line);
  if (first === -1) {
    first = start.line;
    while (first <= last && !parseItem(lines[first])) first++;
    if (first > last) return null;
  }
  const item = parseItem(lines[first])!;

  let to: number;
  if (by === 1) {
    // In under the item above: its text is where this one's bullet goes.
    const above = itemAbove(lines, first, (other) => other.indent <= item.indent);
    if (!above || above.indent < item.indent) return null;
    to = above.prefix;
  } else {
    if (item.indent === 0) return null;
    to = itemAbove(lines, first, (other) => other.indent < item.indent)?.indent ?? 0;
  }
  const shift = to - item.indent;

  // What's under the last item moves with it.
  const lastOwner = owner(lines, last);
  const under = lastOwner === -1 ? Infinity : parseItem(lines[lastOwner])!.indent;
  while (last + 1 < lines.length && lines[last + 1].trim() && indentOf(lines[last + 1]) > under) last++;

  for (let i = first; i <= last; i++) {
    const line = lines[i];
    if (!line.trim() || (!parseItem(line) && !continues(line))) continue;
    lines[i] = " ".repeat(Math.max(0, indentOf(line) + shift)) + line.trimStart();
  }
  // A numbered item moved in starts a new list at 1.
  const moved = parseItem(lines[first])!;
  if (by === 1 && moved.number !== null) lines[first] = format({ ...moved, number: 1 }) + lines[first].slice(moved.prefix);
  return finish(lines, start, end, first);
}

/** Backspace just after a bullet or number: it goes, and the text stays where it was. */
function removeMarker(value: string, caret: number): Edit | null {
  const lines = value.split("\n");
  const spot = spotOf(lines, caret);
  const line = lines[spot.line];
  const item = parseItem(line);
  if (!item || line.length - spot.fromEnd !== item.prefix) return null;
  lines[spot.line] = " ".repeat(item.indent) + line.slice(item.prefix);
  return finish(lines, spot, spot, spot.line);
}

/** "- " or "* " just typed at the start of a line: a bullet. */
export function autoBullet(value: string, caret: number): Edit | null {
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  const match = /^([ \t]*)[-*] $/.exec(value.slice(lineStart, caret));
  if (!match) return null;
  const dash = lineStart + match[1].length;
  return { value: `${value.slice(0, dash)}•${value.slice(dash + 1)}`, start: caret, end: caret };
}

/** Bullets and numbers with nothing after them (like the one Enter left last) don't go in the prompt. */
export function dropEmptyItems(value: string) {
  return value
    .split("\n")
    .filter((line) => {
      const item = parseItem(line);
      return !item || line.slice(item.prefix).trim() !== "";
    })
    .join("\n");
}

// A user's message, cut into plain text and lists.

export type ListBlock = { ordered: boolean; start: number; indent: number; items: ListEntry[] };
export type ListEntry = { text: string; lists: ListBlock[] };
export type Block = { kind: "text"; text: string } | { kind: "list"; list: ListBlock };

/**
 * Plain text and lists: items in a row make a list, indented ones a list inside the
 * item above, and an indented line without a bullet carries on the item above it.
 */
export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let open: ListBlock[] = []; // From the outermost list to the one being added to.
  let plain: string[] = [];

  const endText = () => {
    while (plain.length && !plain[0].trim()) plain.shift();
    while (plain.length && !plain[plain.length - 1].trim()) plain.pop();
    if (plain.length) blocks.push({ kind: "text", text: plain.join("\n") });
    plain = [];
  };

  for (const line of text.split("\n")) {
    const item = parseItem(line);
    if (item) {
      endText();
      const ordered = item.number !== null;
      while (open.length && open[open.length - 1].indent > item.indent) open.pop();
      let list = open[open.length - 1];
      // A bullet after numbers (or numbers after bullets) at the same level starts another list.
      if (list?.indent === item.indent && list.ordered !== ordered) {
        open.pop();
        list = open[open.length - 1];
      }
      if (list?.indent !== item.indent) {
        const parent = list;
        list = { ordered, start: item.number ?? 1, indent: item.indent, items: [] };
        if (parent) parent.items[parent.items.length - 1].lists.push(list);
        else blocks.push({ kind: "list", list });
        open.push(list);
      }
      list.items.push({ text: line.slice(item.prefix), lists: [] });
    } else if (open.length && continues(line) && line.trim()) {
      const items = open[open.length - 1].items;
      items[items.length - 1].text += `\n${line.trim()}`;
    } else {
      open = [];
      plain.push(line);
    }
  }
  endText();
  return blocks;
}
