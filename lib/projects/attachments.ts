import type { ProjectColor } from "@/lib/projects/options";

// Files attached to prompts: what's allowed, and how each kind shows. Shared by the
// prompt box, the chat and the server (lib/projects/server.ts, app/api/attachments).

export const MAX_ATTACHMENTS = 10; // In one prompt.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_NAME = 120;

/** Where a file is served (app/api/attachments/[id]), to its owner only. */
export function attachmentUrl(id: string) {
  return `/api/attachments/${id}`;
}

/** Pictures the AI can look at, as the server found them from their bytes. */
export const AI_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** What shows as the picture itself rather than a document. */
export function isPicture(type: string) {
  return AI_IMAGE_TYPES.includes(type) || type === "image/svg+xml";
}

export type FileKind =
  | "pdf"
  | "doc"
  | "sheet"
  | "slides"
  | "text"
  | "code"
  | "archive"
  | "audio"
  | "video"
  | "image"
  | "other";

const EXTENSIONS: Record<Exclude<FileKind, "other">, string[]> = {
  pdf: ["pdf"],
  doc: ["doc", "docx", "odt", "rtf", "pages"],
  sheet: ["xls", "xlsx", "ods", "csv", "tsv", "numbers"],
  slides: ["ppt", "pptx", "odp", "key"],
  text: ["txt", "md", "markdown", "log"],
  code: "js jsx ts tsx mjs cjs json html htm css scss less py rb go rs java kt swift c h cpp cs php sh sql xml yml yaml toml vue svelte".split(" "),
  archive: ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"],
  audio: ["mp3", "wav", "ogg", "m4a", "flac", "aac"],
  video: ["mp4", "mov", "webm", "mkv", "avi", "m4v"],
  image: ["png", "jpg", "jpeg", "gif", "webp", "svg", "heic", "heif", "avif", "bmp", "tif", "tiff", "ico", "psd", "ai", "fig", "sketch"],
};

/** Each kind of document's color on its tile, from the projects' colors. */
export const KIND_COLORS: Record<FileKind, ProjectColor> = {
  pdf: "red",
  doc: "blue",
  sheet: "green",
  slides: "orange",
  text: "slate",
  code: "violet",
  archive: "amber",
  audio: "pink",
  video: "sky",
  image: "teal",
  other: "slate",
};

/** What kind of file it is, by its extension, or else its type. */
export function fileKind(name: string, type: string): FileKind {
  const ext = extension(name).toLowerCase();
  for (const [kind, list] of Object.entries(EXTENSIONS)) {
    if (list.includes(ext)) return kind as FileKind;
  }
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("text/")) return "text";
  return "other";
}

/** "pdf" for "Menu.pdf"; nothing for a name without one (or a long one, which isn't one). */
export function extension(name: string) {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1) : "";
  return ext.length <= 5 && /^[a-z0-9]+$/i.test(ext) ? ext : "";
}

/** "820 B", "12 KB", "1.4 MB". */
export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}

/** A file's name as it's kept: no folders or control characters, and not too long. */
export function cleanFileName(name: unknown) {
  const base = String(name ?? "")
    .split(/[\\/]/)
    .at(-1)!
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  if (!base || base === "." || base === "..") return "file";
  if (base.length <= MAX_NAME) return base;
  const ext = extension(base);
  return ext ? `${base.slice(0, MAX_NAME - ext.length - 1)}.${ext}` : base.slice(0, MAX_NAME);
}
