import type { BuildAction } from "./projects";

/*
 * What the mock AI does while it builds a project's first version (projects.ts): the steps it goes
 * through, in words anyone can follow, and the searches, files and commands under each, shaped like
 * a generated app (React, Vite, TypeScript, Tailwind CSS and shadcn/ui).
 */

// What the AI says before it starts building.
export const buildIntro = (name: string) => `Great idea! I’ll build ${name} from your description.`;

// What it says when it builds again after the user stopped it.
export const rebuildIntro = (name: string) =>
  `Picking up where I stopped. I’ll finish building ${name}.`;

// An action as planned: weight is how long it takes, relative to the others.
export type PlannedAction = Omit<BuildAction, "id" | "status"> & { weight: number };

export type PlannedStep = { title: string; actions: PlannedAction[] };

// The name as a component's file name, e.g. "Habit Tracker" → "HabitTracker". Main when the name
// isn't plain letters and digits, or is the stock one.
function componentName(name: string) {
  if (name === "Untitled project") return "Main";
  const words = name.split(/[\s’-]+/).filter(Boolean);
  if (!words.every((word) => /^[A-Za-z0-9]+$/.test(word))) return "Main";
  const joined = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
  return /^[A-Z]/.test(joined) ? joined : "Main";
}

export function buildPlan(name: string): PlannedStep[] {
  const topic = name === "Untitled project" ? "app" : name.toLocaleLowerCase();
  const component = componentName(name);
  return [
    {
      title: "Understanding your idea",
      actions: [{ kind: "search", target: `${topic} design ideas`, weight: 6 }],
    },
    {
      title: "Setting up the project",
      actions: [
        { kind: "command", target: "npm create vite@latest", weight: 4 },
        { kind: "command", target: "npm install", weight: 7 },
        { kind: "create", target: "src/main.tsx", lines: 12, weight: 2 },
      ],
    },
    {
      title: "Picking colors and fonts",
      actions: [
        { kind: "search", target: `${topic} color palettes`, weight: 5 },
        { kind: "edit", target: "src/index.css", lines: 42, weight: 3 },
      ],
    },
    {
      title: "Building the main screens",
      actions: [
        { kind: "create", target: "src/components/Header.tsx", lines: 36, weight: 3 },
        { kind: "create", target: "src/pages/Home.tsx", lines: 88, weight: 4 },
        { kind: "create", target: `src/components/${component}.tsx`, lines: 124, weight: 5 },
        { kind: "create", target: "src/data/sample.ts", lines: 57, weight: 3 },
        { kind: "edit", target: "src/App.tsx", lines: 18, weight: 2 },
      ],
    },
    {
      title: "Making it work on phones",
      actions: [
        { kind: "edit", target: "src/components/Header.tsx", lines: 14, weight: 3 },
        { kind: "edit", target: "src/pages/Home.tsx", lines: 9, weight: 3 },
      ],
    },
    {
      title: "Final checks",
      actions: [{ kind: "command", target: "npm run build", weight: 6 }],
    },
  ];
}
