/*
 * A short random id. Not crypto.randomUUID: browsers have it only on secure origins, and the dev
 * server is also opened over plain http from phones on the local network.
 */
export function newId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (byte) =>
    (byte % 36).toString(36),
  ).join("");
}
