import "server-only";
import type { ResponseInputMessageContentList } from "openai/resources/responses/responses";
import { AI_IMAGE_TYPES } from "@/lib/projects/attachments";
import { attachmentData } from "@/lib/projects/server";
import type { Attachment, Message, UserMessage } from "@/lib/projects/types";

// How the AI sees the files attached to prompts: pictures and PDFs go with the prompt
// itself, and every file is in the project's attachments/ folder (lib/sandbox/attachments.ts),
// which it's told about, to read with its tools or copy into the app.

// Pictures and PDFs sent in one request, newest first: OpenAI takes 50 MB at most, and
// base64 makes them a third bigger. Older ones past this are only named.
const MAX_SHOWN_BYTES = 30 * 1024 * 1024;

const PDF = "application/pdf";

function canSee(file: Attachment) {
  return AI_IMAGE_TYPES.includes(file.type) || file.type === PDF;
}

/** The chat as the AI gets it, prompts with their files. Text-only messages stay plain text. */
export function withAttachments(messages: Message[], paths: Map<string, string>) {
  // Newest first, so the latest prompt's files are always seen.
  const shown = new Set<string>();
  let bytes = 0;
  for (const message of messages.toReversed()) {
    if (message.role !== "user") continue;
    for (const file of message.attachments ?? []) {
      if (!canSee(file) || bytes + file.size > MAX_SHOWN_BYTES) continue;
      shown.add(file.id);
      bytes += file.size;
    }
  }
  const data = attachmentData([...shown]);
  return (message: UserMessage) => promptContent(message, paths, shown, data);
}

/**
 * A prompt with files: its text, then where each file is in the project and how to get
 * at it, then the pictures and PDFs themselves.
 */
function promptContent(
  message: UserMessage,
  paths: Map<string, string>,
  shown: Set<string>,
  data: Map<string, Buffer>,
): string | ResponseInputMessageContentList {
  const files = message.attachments ?? [];
  if (files.length === 0) return message.text;

  const list = files.map((file) => {
    const where = paths.get(file.id) ?? file.name;
    if (!canSee(file)) return `${where} (read it with read_file if it's text)`;
    const what = file.type === PDF ? "PDF" : "picture";
    return shown.has(file.id) && data.has(file.id) ? `${where} (${what}, below)` : `${where} (${what})`;
  });
  const note = `[Attached, in the project as they sent them: ${list.join(", ")}]`;
  const content: ResponseInputMessageContentList = [
    { type: "input_text", text: message.text ? `${message.text}\n\n${note}` : note },
  ];
  for (const file of files) {
    const bytes = shown.has(file.id) ? data.get(file.id) : undefined;
    if (!bytes) continue;
    const url = `data:${file.type};base64,${bytes.toString("base64")}`;
    content.push(
      file.type === PDF
        ? { type: "input_file", filename: file.name, file_data: url }
        : { type: "input_image", image_url: url, detail: "auto" },
    );
  }
  return content;
}
