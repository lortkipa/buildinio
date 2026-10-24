import type { ProjectColor, ProjectIconName } from "./project-icon";
import type { Message, Project } from "./projects";

/*
 * Demo content for the mocked projects (projects.ts): the projects every page load starts with, and
 * the AI's canned replies. Only frontend apps, as in Phase 1. What the AI does while it builds is in
 * mock-build.ts.
 */

// What the first version of every app has, as the AI lists it and the mock preview shows it.
export const FIRST_VERSION = [
  "A clean layout that works on phones and computers",
  "The main screens from your description, with sample content to try",
  "Light and dark mode that follow your device",
];

// What the AI says once it has built a project's first version.
export const firstReply = (name: string) => `${name} is ready! Here’s the first version:

${FIRST_VERSION.map((feature) => `• ${feature}`).join("\n")}

Tell me what to change, add or remove next.`;

// The AI's replies to later messages, taken in turn.
export const FOLLOW_UP_REPLIES = [
  "Done! I made that change. Take a look and tell me if it feels right, or what to adjust.",
  "Good idea. I’ve updated the layout and kept everything else as it was. Anything else you’d like to tweak?",
  "All set. I also tidied up the spacing on smaller screens, so it reads well on phones.",
  "I’ve added that. If you’d like a different style for it, describe how it should look and I’ll restyle it.",
];

/*
 * A demo project, already built. Its chat goes as a new project's does once built: the prompt, the
 * AI's first reply, then user and AI messages in turn. Ids are fixed, so the server and the
 * browser render the same.
 */
function seed({
  id,
  name,
  icon,
  color,
  chat: [prompt = "", ...later],
}: {
  id: string;
  name: string;
  icon: ProjectIconName;
  color: ProjectColor;
  chat: string[];
}): Project {
  const texts = [prompt, firstReply(name), ...later];
  return {
    id,
    name,
    icon,
    color,
    replying: false,
    built: true,
    messages: texts.map(
      (text, index): Message => ({
        id: `${id}-${index}`,
        role: index % 2 === 0 ? "user" : "ai",
        text,
      }),
    ),
  };
}

export const SEED_PROJECTS: Project[] = [
  seed({
    id: "k7m2q9xa",
    name: "Habit Tracker",
    icon: "calendar-check",
    color: "violet",
    chat: [
      "A habit tracker with daily streaks and a calendar view",
      "Can it celebrate when I keep a streak for 7 days?",
      "Done! When a streak reaches 7 days, a burst of confetti plays and the habit gets a small flame badge. The badge grows at 30 and 100 days.",
    ],
  }),
  seed({
    id: "p3v8n1cd",
    name: "Coffee Shop Site",
    icon: "coffee",
    color: "amber",
    chat: [
      "A landing page for my coffee shop with the menu and opening hours",
      "Make it feel warmer, like a cozy café",
      "I switched to a cream background with warm brown text, rounded photos and a handwritten font for the headings. The menu now has small illustrations next to each section.",
      "Love it. Can the opening hours show if we’re open right now?",
      "Yes! The hours now show a green “Open now” or a gray “Closed” label, based on the visitor’s time, with today’s hours highlighted.",
    ],
  }),
  seed({
    id: "r5t1w6ef",
    name: "Recipe Box",
    icon: "chef-hat",
    color: "coral",
    chat: [
      "A recipe box where I can save and search my favorite meals",
      "Add filters for vegetarian and quick meals",
      "Added two filter chips above the list: Vegetarian and Under 30 min. They can be combined, and the search keeps working with them.",
    ],
  }),
  seed({
    id: "b9h4j2gk",
    name: "Spanish Flashcards",
    icon: "book-open",
    color: "orange",
    chat: ["A flashcard app to help me learn Spanish"],
  }),
  seed({
    id: "d2f7l5mn",
    name: "Photo Portfolio",
    icon: "camera",
    color: "slate",
    chat: [
      "A portfolio site to show off my photography",
      "Photos should open full screen when clicked",
      "Clicking a photo now opens it full screen on a dark background. Arrow keys or swipes move between photos, and Escape closes it.",
    ],
  }),
  seed({
    id: "g6q3s8pr",
    name: "Workout Timer",
    icon: "dumbbell",
    color: "emerald",
    chat: [
      "A workout timer with custom intervals and rest breaks",
      "Add a sound when a rest break ends",
      "A short beep now plays 3 seconds before a rest break ends, and a longer one when the next interval starts. There’s a mute button in the corner.",
    ],
  }),
  seed({
    id: "h1x9z4st",
    name: "Budget Planner",
    icon: "wallet",
    color: "lime",
    chat: [
      "A budget planner that shows where my money goes each month",
      "Show the spending as a pie chart",
      "The overview now has a pie chart by category, with the biggest categories first. Tapping a slice shows its transactions below.",
    ],
  }),
  seed({
    id: "j8c5v7uw",
    name: "Trip Planner",
    icon: "plane",
    color: "blue",
    chat: [
      "A trip planner with a day-by-day plan and a packing list",
      "Can the packing list have checkboxes?",
      "Yes. Every item has a checkbox now, packed items move to the bottom, and a progress bar at the top shows how much is packed.",
    ],
  }),
  seed({
    id: "m4n6b3yz",
    name: "Wedding Website",
    icon: "heart",
    color: "magenta",
    chat: ["A wedding website with our story, the schedule and a map"],
  }),
  seed({
    id: "q2w8e5ra",
    name: "Band Page",
    icon: "music",
    color: "violet",
    chat: [
      "A page for my band with tour dates and our latest songs",
      "Make the tour dates stand out more",
      "The tour dates are now big cards with the date in bold, the city and venue below, and a “Tickets” button. Past dates fade out at the end of the list.",
    ],
  }),
  seed({
    id: "t7y1u4ib",
    name: "Plant Care List",
    icon: "leaf",
    color: "emerald",
    chat: ["A plant care list for my houseplants with watering days"],
  }),
  seed({
    id: "v3o9p6lc",
    name: "Retro Snake Game",
    icon: "gamepad-2",
    color: "cyan",
    chat: [
      "A retro snake game with a high score",
      "Add arrow buttons for playing on a phone",
      "Added a round arrow pad below the board on touch screens. Swiping on the board works too.",
    ],
  }),
];
