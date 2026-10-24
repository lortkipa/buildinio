import { newId } from "./new-id";

/*
 * Files attached to a prompt: images and documents that help describe the app. Kept as blob URLs in
 * the browser's memory, like the mocked projects (projects.ts), until uploads reach the API.
 */

export type AttachmentKind = "image" | "pdf" | "doc" | "sheet" | "slides" | "code" | "text";

export type Attachment = {
  id: string;
  name: string;
  size: number;
  kind: AttachmentKind;
  url: string;
};

const MB = 1024 * 1024;
export const MAX_FILES = 20;
export const MAX_FILE_BYTES = 25 * MB;
export const MAX_TOTAL_BYTES = 100 * MB;

// The documents that can be attached, by extension. Any image can.
const KIND_BY_EXTENSION: Record<string, Exclude<AttachmentKind, "image">> = {
  pdf: "pdf",
  doc: "doc",
  docx: "doc",
  odt: "doc",
  rtf: "doc",
  xls: "sheet",
  xlsx: "sheet",
  ods: "sheet",
  csv: "sheet",
  tsv: "sheet",
  ppt: "slides",
  pptx: "slides",
  odp: "slides",
  html: "code",
  css: "code",
  js: "code",
  jsx: "code",
  ts: "code",
  tsx: "code",
  json: "code",
  xml: "code",
  yaml: "code",
  yml: "code",
  txt: "text",
  md: "text",
};

// For the file input, so the file browser shows only these.
export const ACCEPT = [
  "image/*",
  ...Object.keys(KIND_BY_EXTENSION).map((extension) => `.${extension}`),
].join(",");

function extension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

// The format, as a short badge, e.g. "PDF".
export function formatLabel(attachment: Attachment) {
  return extension(attachment.name).slice(0, 4).toUpperCase() || "FILE";
}

// Undefined for a file that can't be attached. The file browser's "All files" can get past ACCEPT.
function kindOf(file: File): AttachmentKind | undefined {
  if (file.type.startsWith("image/")) return "image";
  return KIND_BY_EXTENSION[extension(file.name)];
}

/*
 * The files that fit next to the ones already attached, in order, and why the first one that didn't
 * was left out (for a toast).
 */
export function attachFiles(current: Attachment[], files: Iterable<File>) {
  const added: Attachment[] = [];
  let error: string | undefined;
  let count = current.length;
  let total = current.reduce((sum, attachment) => sum + attachment.size, 0);
  for (const file of files) {
    const kind = kindOf(file);
    let reason: string | undefined;
    if (!kind) reason = `“${file.name}” can’t be attached. Add images or documents.`;
    else if (file.size > MAX_FILE_BYTES) reason = `“${file.name}” is over 25 MB.`;
    else if (count === MAX_FILES) reason = `You can attach up to ${MAX_FILES} files.`;
    else if (total + file.size > MAX_TOTAL_BYTES)
      reason = "Files can add up to 100 MB in a message.";
    if (reason || !kind) {
      error ??= reason;
      continue;
    }
    added.push({
      id: newId(),
      name: file.name,
      size: file.size,
      kind,
      url: URL.createObjectURL(file),
    });
    count++;
    total += file.size;
  }
  return { added, error };
}

// Frees the files' memory once nothing shows them anymore.
export function revokeAttachments(attachments: readonly Attachment[]) {
  for (const attachment of attachments) URL.revokeObjectURL(attachment.url);
}
