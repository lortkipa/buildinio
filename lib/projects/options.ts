import {
  BookOpen,
  Briefcase,
  CalendarDays,
  Camera,
  Car,
  Coffee,
  Dumbbell,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  House,
  Leaf,
  Music,
  Palette,
  PawPrint,
  Plane,
  Rocket,
  Scissors,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  Utensils,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// What a project can look like in the sidebar: picked by the AI, changed in the edit dialog.

export const PROJECT_COLORS = {
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  green: "#22c55e",
  teal: "#14b8a6",
  sky: "#0ea5e9",
  blue: "#3b82f6",
  violet: "#8b5cf6",
  pink: "#ec4899",
  slate: "#64748b",
} as const;

export const PROJECT_ICONS = {
  sparkles: Sparkles,
  scissors: Scissors,
  coffee: Coffee,
  utensils: Utensils,
  store: Store,
  "shopping-bag": ShoppingBag,
  calendar: CalendarDays,
  dumbbell: Dumbbell,
  heart: Heart,
  gift: Gift,
  book: BookOpen,
  graduation: GraduationCap,
  briefcase: Briefcase,
  users: Users,
  house: House,
  plane: Plane,
  car: Car,
  paw: PawPrint,
  leaf: Leaf,
  music: Music,
  camera: Camera,
  palette: Palette,
  gamepad: Gamepad2,
  rocket: Rocket,
} satisfies Record<string, LucideIcon>;

export type ProjectColor = keyof typeof PROJECT_COLORS;
export type ProjectIcon = keyof typeof PROJECT_ICONS;

export const COLOR_NAMES = Object.keys(PROJECT_COLORS) as ProjectColor[];
export const ICON_NAMES = Object.keys(PROJECT_ICONS) as ProjectIcon[];

export const MAX_PROJECT_NAME = 60;
