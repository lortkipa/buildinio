const ONE_YEAR = 60 * 60 * 24 * 365;

// Remembers a layout choice (the sidebar's or the preview's) for the server to render next time.
export function saveCookie(name: string, value: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is missing in older Safari
  document.cookie = `${name}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}
