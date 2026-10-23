import type { Message, Project } from "./projects";

/*
 * Demo content for the mocked projects (projects.ts): the projects every page load starts with, and
 * the AI's canned replies. Only frontend apps, as in Phase 1.
 */

// The AI's reply to the prompt that started a project.
export const firstReply = (
  name: string,
) => `I’ve started building ${name}. Here’s the first version:

• A clean layout that works on phones and computers
• The main screens from your description, with sample content to try
• Light and dark mode that follow your device

Tell me what to change, add or remove next.`;

// The AI's replies to later messages, taken in turn.
export const FOLLOW_UP_REPLIES = [
  "Done! I made that change. Take a look and tell me if it feels right, or what to adjust.",
  "Good idea. I’ve updated the layout and kept everything else as it was. Anything else you’d like to tweak?",
  "All set. I also tidied up the spacing on smaller screens, so it reads well on phones.",
  "I’ve added that. If you’d like a different style for it, describe how it should look and I’ll restyle it.",
];

// Alternating user and AI messages, starting with the user's. Ids are fixed, so the server and the
// browser render the same.
function chat(projectId: string, ...texts: string[]): Message[] {
  return texts.map(
    (text, index): Message => ({
      id: `${projectId}-${index}`,
      role: index % 2 === 0 ? "user" : "ai",
      text,
    }),
  );
}

export const SEED_PROJECTS: Project[] = [
  {
    id: "k7m2q9xa",
    name: "Habit Tracker",
    icon: "calendar-check",
    color: "violet",
    replying: false,
    messages: chat(
      "k7m2q9xa",
      "A habit tracker with daily streaks and a calendar view",
      firstReply("Habit Tracker"),
      "Can it celebrate when I keep a streak for 7 days?",
      "Done! When a streak reaches 7 days, a burst of confetti plays and the habit gets a small flame badge. The badge grows at 30 and 100 days.",
    ),
  },
  {
    id: "p3v8n1cd",
    name: "Coffee Shop Site",
    icon: "coffee",
    color: "amber",
    replying: false,
    messages: chat(
      "p3v8n1cd",
      "A landing page for my coffee shop with the menu and opening hours",
      firstReply("Coffee Shop Site"),
      "Make it feel warmer, like a cozy café",
      "I switched to a cream background with warm brown text, rounded photos and a handwritten font for the headings. The menu now has small illustrations next to each section.",
      "Love it. Can the opening hours show if we’re open right now?",
      "Yes! The hours now show a green “Open now” or a gray “Closed” label, based on the visitor’s time, with today’s hours highlighted.",
    ),
  },
  {
    id: "r5t1w6ef",
    name: "Recipe Box",
    icon: "chef-hat",
    color: "coral",
    replying: false,
    messages: chat(
      "r5t1w6ef",
      "A recipe box where I can save and search my favorite meals",
      firstReply("Recipe Box"),
      "Add filters for vegetarian and quick meals",
      "Added two filter chips above the list: Vegetarian and Under 30 min. They can be combined, and the search keeps working with them.",
    ),
  },
  {
    id: "b9h4j2gk",
    name: "Spanish Flashcards",
    icon: "book-open",
    color: "orange",
    replying: false,
    messages: chat(
      "b9h4j2gk",
      "A flashcard app to help me learn Spanish",
      firstReply("Spanish Flashcards"),
    ),
  },
  {
    id: "d2f7l5mn",
    name: "Photo Portfolio",
    icon: "camera",
    color: "slate",
    replying: false,
    messages: chat(
      "d2f7l5mn",
      "A portfolio site to show off my photography",
      firstReply("Photo Portfolio"),
      "Photos should open full screen when clicked",
      "Clicking a photo now opens it full screen on a dark background. Arrow keys or swipes move between photos, and Escape closes it.",
    ),
  },
  {
    id: "g6q3s8pr",
    name: "Workout Timer",
    icon: "dumbbell",
    color: "emerald",
    replying: false,
    messages: chat(
      "g6q3s8pr",
      "A workout timer with custom intervals and rest breaks",
      firstReply("Workout Timer"),
      "Add a sound when a rest break ends",
      "A short beep now plays 3 seconds before a rest break ends, and a longer one when the next interval starts. There’s a mute button in the corner.",
    ),
  },
  {
    id: "h1x9z4st",
    name: "Budget Planner",
    icon: "wallet",
    color: "lime",
    replying: false,
    messages: chat(
      "h1x9z4st",
      "A budget planner that shows where my money goes each month",
      firstReply("Budget Planner"),
      "Show the spending as a pie chart",
      "The overview now has a pie chart by category, with the biggest categories first. Tapping a slice shows its transactions below.",
    ),
  },
  {
    id: "j8c5v7uw",
    name: "Trip Planner",
    icon: "plane",
    color: "blue",
    replying: false,
    messages: chat(
      "j8c5v7uw",
      "A trip planner with a day-by-day plan and a packing list",
      firstReply("Trip Planner"),
      "Can the packing list have checkboxes?",
      "Yes. Every item has a checkbox now, packed items move to the bottom, and a progress bar at the top shows how much is packed.",
    ),
  },
  {
    id: "m4n6b3yz",
    name: "Wedding Website",
    icon: "heart",
    color: "magenta",
    replying: false,
    messages: chat(
      "m4n6b3yz",
      "A wedding website with our story, the schedule and a map",
      firstReply("Wedding Website"),
    ),
  },
  {
    id: "q2w8e5ra",
    name: "Band Page",
    icon: "music",
    color: "violet",
    replying: false,
    messages: chat(
      "q2w8e5ra",
      "A page for my band with tour dates and our latest songs",
      firstReply("Band Page"),
      "Make the tour dates stand out more",
      "The tour dates are now big cards with the date in bold, the city and venue below, and a “Tickets” button. Past dates fade out at the end of the list.",
    ),
  },
  {
    id: "t7y1u4ib",
    name: "Plant Care List",
    icon: "leaf",
    color: "emerald",
    replying: false,
    messages: chat(
      "t7y1u4ib",
      "A plant care list for my houseplants with watering days",
      firstReply("Plant Care List"),
    ),
  },
  {
    id: "v3o9p6lc",
    name: "Retro Snake Game",
    icon: "gamepad-2",
    color: "cyan",
    replying: false,
    messages: chat(
      "v3o9p6lc",
      "A retro snake game with a high score",
      firstReply("Retro Snake Game"),
      "Add arrow buttons for playing on a phone",
      "Added a round arrow pad below the board on touch screens. Swiping on the board works too.",
    ),
  },
];
