// Ids for projects and messages, made in the browser so a new chat can open right away.
// A project's id is also the address of its preview (see app/preview), so it's long and random.

const ID = /^[0-9a-z]{32}$/;

/** 128 random bits. Not crypto.randomUUID: that's missing over plain http (a phone on the LAN). */
export function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("");
}

export function isId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}
