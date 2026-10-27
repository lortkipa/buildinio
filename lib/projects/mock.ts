import { COLOR_NAMES, ICON_NAMES } from "@/lib/projects/options";
import type { ProjectColor, ProjectIcon } from "@/lib/projects/options";
import type { Step } from "@/lib/projects/types";

// The fake AI's words. Nothing here calls a real model: it's all canned, picked
// from keywords in the prompt, so the chat can be designed before the AI exists.

type Idea = {
  name: string;
  icon: ProjectIcon;
  color: ProjectColor;
  pitch: string; // Finishes "I'll build <name>: …".
  search: string;
  component: string;
  features: [string, string, string];
};

const IDEAS: (Omit<Idea, "features"> & { match: RegExp; features: Idea["features"] })[] = [
  {
    match: /salon|hair|barber|beauty|nail|spa/i,
    name: "Salon Booking",
    icon: "scissors",
    color: "pink",
    pitch: "a booking page where clients pick a service, a stylist and a time that suits them",
    search: "best hair salon booking apps",
    component: "BookingForm",
    features: [
      "A home page with your services, prices and opening hours",
      "A booking form where clients pick a service, a stylist and a free time slot",
      "A confirmation screen with the details of each booking",
    ],
  },
  {
    match: /caf[eé]|coffee|menu|restaurant|bakery|food|bar\b/i,
    name: "Café Menu",
    icon: "coffee",
    color: "amber",
    pitch: "an online menu with your drinks and food, sorted into sections with prices and photos",
    search: "café online menu design ideas",
    component: "MenuSection",
    features: [
      "A menu split into sections, like coffee, tea and pastries",
      "Prices, short descriptions and a photo for each item",
      "Your address and opening hours at the bottom",
    ],
  },
  {
    match: /habit|routine|goal|nudge|streak/i,
    name: "Habit Tracker",
    icon: "leaf",
    color: "green",
    pitch: "a simple tracker where you tick off your habits each day and watch your streaks grow",
    search: "habit tracker app features people love",
    component: "HabitList",
    features: [
      "A list of your habits with one tap to tick each off for today",
      "Streaks that count how many days in a row you kept going",
      "A morning reminder that nudges you to start",
    ],
  },
  {
    match: /portal|client|studio|agency|freelanc/i,
    name: "Client Portal",
    icon: "briefcase",
    color: "blue",
    pitch: "a private space where your clients see their projects, files and invoices in one place",
    search: "client portal for design studios",
    component: "ProjectBoard",
    features: [
      "A sign-in page so each client only sees their own work",
      "A board with every project and where it's at",
      "A place to share files and invoices",
    ],
  },
  {
    match: /gift|wish|birthday|christmas|wedding list/i,
    name: "Gift List",
    icon: "gift",
    color: "red",
    pitch: "a shared list where family members add gift ideas and quietly mark what they'll buy",
    search: "shared family gift list app",
    component: "GiftList",
    features: [
      "A list for each person with their gift ideas",
      "A way to mark a gift as taken, hidden from the person getting it",
      "Links and prices next to each idea",
    ],
  },
  {
    match: /gym|fitness|workout|yoga|train/i,
    name: "Workout Planner",
    icon: "dumbbell",
    color: "orange",
    pitch: "a planner for your weekly workouts, with exercises, sets and progress",
    search: "workout planner app layout",
    component: "WorkoutWeek",
    features: [
      "A week view with a workout for each day",
      "Exercises with sets, reps and a timer for rests",
      "A progress page that shows how far you've come",
    ],
  },
  {
    match: /shop|store|sell|product|boutique/i,
    name: "Online Shop",
    icon: "shopping-bag",
    color: "violet",
    pitch: "a small shop where people browse your products, add them to a cart and check out",
    search: "small online shop design examples",
    component: "ProductGrid",
    features: [
      "A product grid with photos, names and prices",
      "A cart that keeps what people picked",
      "A simple checkout page",
    ],
  },
  {
    match: /pet|dog|cat|vet|puppy/i,
    name: "Pet Care",
    icon: "paw",
    color: "teal",
    pitch: "a place to keep your pet's meals, walks, vet visits and reminders",
    search: "pet care tracker app ideas",
    component: "PetProfile",
    features: [
      "A profile for each pet with a photo and the basics",
      "A daily log for meals and walks",
      "Reminders for vet visits and medicine",
    ],
  },
  {
    match: /travel|trip|vacation|holiday|itinerar/i,
    name: "Trip Planner",
    icon: "plane",
    color: "sky",
    pitch: "a trip planner with your days, places to visit and bookings in one timeline",
    search: "trip itinerary planner app",
    component: "TripTimeline",
    features: [
      "A day-by-day timeline of the trip",
      "Places to visit with notes and links",
      "A spot for flight and hotel bookings",
    ],
  },
  {
    match: /event|party|meetup|conference|rsvp/i,
    name: "Event Planner",
    icon: "calendar",
    color: "violet",
    pitch: "an event page with the details, a schedule and an RSVP form for your guests",
    search: "event page with rsvp examples",
    component: "RsvpForm",
    features: [
      "An event page with the date, place and schedule",
      "An RSVP form that collects who's coming",
      "A guest list you can check at a glance",
    ],
  },
  {
    match: /recipe|cook|meal|kitchen/i,
    name: "Recipe Book",
    icon: "utensils",
    color: "orange",
    pitch: "a recipe book where you save dishes with ingredients, steps and photos",
    search: "recipe book app design",
    component: "RecipeCard",
    features: [
      "A collection of recipes with a photo for each",
      "Ingredients and steps that are easy to follow while cooking",
      "Search to find a recipe by name or ingredient",
    ],
  },
  {
    match: /school|class|student|teacher|course|lesson/i,
    name: "Class Hub",
    icon: "graduation",
    color: "blue",
    pitch: "a hub for your class with lessons, homework and announcements",
    search: "class website for teachers examples",
    component: "LessonList",
    features: [
      "A home page with the latest announcements",
      "A list of lessons with homework for each",
      "A calendar with due dates",
    ],
  },
];

/** What the AI will call the project and build, guessed from the prompt. */
export function guessIdea(prompt: string): Idea {
  const idea = IDEAS.find(({ match }) => match.test(prompt));
  if (idea) return idea;

  const seed = hash(prompt);
  const name = nameFromPrompt(prompt);
  return {
    name,
    icon: ICON_NAMES[seed % ICON_NAMES.length],
    color: COLOR_NAMES[seed % COLOR_NAMES.length],
    pitch: "an app that does exactly what you described, with a clear home page and simple screens",
    search: `${name.toLowerCase()} app examples`,
    component: "MainScreen",
    features: [
      "A home page that explains what the app is for",
      "The main screen with everything you asked for",
      "Clear buttons and short, friendly wording",
    ],
  };
}

const FILLER = new Set(
  "a an the app apps website site page for my our me us to that with of and in on i want need would like build make create please can you simple small little new".split(" "),
);

/** A couple of words from the prompt, like "Plant Watering" from "an app for plant watering". */
function nameFromPrompt(prompt: string) {
  const words = prompt
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word && !FILLER.has(word))
    .slice(0, 2);
  if (words.length === 0) return "New App";
  return words.map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

function hash(text: string) {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

/** Steps of the build, before they get ids and times. `ms` is how long a tool runs. */
export type StepPlan =
  | { kind: "text"; text: string }
  | (Omit<Extract<Step, { kind: "tool" }>, "id" | "done"> & { ms: number });

export function buildPlan(idea: Idea): StepPlan[] {
  return [
    {
      kind: "text",
      text: `Love it. I'll build **${idea.name}**: ${idea.pitch}.\n\nFirst I'll look at how similar apps do it, then set up the pages, and finally check that it all works on phones and computers.`,
    },
    {
      kind: "tool",
      tool: "search",
      label: "Searching the web",
      doneLabel: "Searched the web",
      detail: idea.search,
      ms: 1800,
    },
    {
      kind: "tool",
      tool: "read",
      label: "Reading 3 pages",
      doneLabel: "Read 3 pages",
      detail: "Examples and tips",
      ms: 1400,
    },
    { kind: "text", text: "Good, I have what I need. Setting up the pages now." },
    {
      kind: "tool",
      tool: "create",
      label: "Creating app/page.tsx",
      doneLabel: "Created app/page.tsx",
      added: 86,
      ms: 1200,
    },
    {
      kind: "tool",
      tool: "create",
      label: `Creating components/${idea.component}.tsx`,
      doneLabel: `Created components/${idea.component}.tsx`,
      added: 124,
      ms: 1600,
    },
    {
      kind: "tool",
      tool: "create",
      label: "Creating lib/data.ts",
      doneLabel: "Created lib/data.ts",
      added: 48,
      ms: 900,
    },
    {
      kind: "tool",
      tool: "edit",
      label: "Editing app/layout.tsx",
      doneLabel: "Edited app/layout.tsx",
      added: 12,
      removed: 3,
      ms: 900,
    },
    { kind: "text", text: "Now the colors and spacing, so it feels right on every screen." },
    {
      kind: "tool",
      tool: "edit",
      label: "Editing app/globals.css",
      doneLabel: "Edited app/globals.css",
      added: 31,
      removed: 2,
      ms: 1100,
    },
    {
      kind: "tool",
      tool: "run",
      label: "Checking that everything works",
      doneLabel: "Checked that everything works",
      detail: "No problems found",
      ms: 2000,
    },
  ];
}

/** What the AI says once the app is built, in place of everything it said while building. */
export function buildSummary(idea: Idea) {
  return [
    `**${idea.name}** is ready. Here's what I built:`,
    [...idea.features, "A layout that works on phones, tablets and computers"]
      .map((feature) => `- ${feature}`)
      .join("\n"),
    "Want to change anything? Tell me what to add, remove or reword.",
  ].join("\n\n");
}

const REPLIES = [
  "Sure. I'd change that on the main page and keep everything else as it is, so nothing you like gets lost. Want me to adjust the colors to match while I'm at it?",
  "Good question. Right now everything sits on one page to keep it simple. If you'd like, I can split it into **separate pages**, with a menu at the top to move between them.",
  "That makes sense. The clearest way is a short welcome line at the top with the main button right under it, so people know what to do first.",
  "Happy to. I'd keep the wording short and friendly, the way you'd say it in person. Anything else you'd like to change?",
];

/** A plain answer to a follow-up: no tools, no building. Takes turns through the canned ones. */
export function replyFor(answered: number) {
  return REPLIES[answered % REPLIES.length];
}
