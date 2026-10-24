import type { Device } from "./settings-account";

/*
 * The other devices the user is logged in on, for the settings' Account tab, until they come from
 * the API (Better Auth's sessions).
 */
export const MOCK_SESSIONS: (Device & { id: string; lastActive: string })[] = [
  { id: "iphone", name: "Safari on iPhone", kind: "phone", lastActive: "2 hours ago" },
  { id: "windows", name: "Firefox on Windows", kind: "computer", lastActive: "3 days ago" },
  { id: "ipad", name: "Chrome on iPad", kind: "tablet", lastActive: "2 weeks ago" },
];
