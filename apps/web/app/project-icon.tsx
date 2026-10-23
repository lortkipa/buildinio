import {
  BookOpenIcon,
  BriefcaseIcon,
  CalendarCheckIcon,
  CameraIcon,
  ChefHatIcon,
  CodeIcon,
  CoffeeIcon,
  DumbbellIcon,
  Gamepad2Icon,
  GlobeIcon,
  GraduationCapIcon,
  HeartIcon,
  LeafIcon,
  ListTodoIcon,
  MapPinIcon,
  MessageCircleIcon,
  MusicIcon,
  PaletteIcon,
  PlaneIcon,
  RocketIcon,
  ShoppingBagIcon,
  SparklesIcon,
  StarIcon,
  WalletIcon,
} from "./icons";

// The icons a project can have, in the order the icon dialog shows them.
export const PROJECT_ICONS = {
  sparkles: SparklesIcon,
  rocket: RocketIcon,
  globe: GlobeIcon,
  "shopping-bag": ShoppingBagIcon,
  coffee: CoffeeIcon,
  "chef-hat": ChefHatIcon,
  "calendar-check": CalendarCheckIcon,
  "list-todo": ListTodoIcon,
  dumbbell: DumbbellIcon,
  camera: CameraIcon,
  music: MusicIcon,
  "book-open": BookOpenIcon,
  "graduation-cap": GraduationCapIcon,
  wallet: WalletIcon,
  plane: PlaneIcon,
  heart: HeartIcon,
  "gamepad-2": Gamepad2Icon,
  palette: PaletteIcon,
  "message-circle": MessageCircleIcon,
  "map-pin": MapPinIcon,
  briefcase: BriefcaseIcon,
  leaf: LeafIcon,
  code: CodeIcon,
  star: StarIcon,
};

/*
 * The colors a project can have, around the color wheel: the five brand colors with Tailwind's
 * orange, cyan, emerald, lime and slate (500) in between. A project's icon and its user's messages
 * are drawn in a tint of it (project-tint and project-glyph in globals.css).
 */
export const PROJECT_COLORS = {
  amber: "#ffb21e",
  orange: "oklch(70.5% 0.213 47.604)",
  coral: "#ff4f6d",
  magenta: "#e23fa8",
  violet: "#7a5bff",
  blue: "#2e9bff",
  cyan: "oklch(71.5% 0.143 215.221)",
  emerald: "oklch(69.6% 0.17 162.48)",
  lime: "oklch(76.8% 0.233 130.85)",
  slate: "oklch(55.4% 0.046 257.417)",
};

export type ProjectIconName = keyof typeof PROJECT_ICONS;
export type ProjectColor = keyof typeof PROJECT_COLORS;

export const ICON_NAMES = Object.keys(PROJECT_ICONS) as ProjectIconName[];
export const COLOR_NAMES = Object.keys(PROJECT_COLORS) as ProjectColor[];

// Sets --project, which project-tint and project-glyph read, for an element and what's inside it.
export const projectColorStyle = (color: ProjectColor) =>
  ({ "--project": PROJECT_COLORS[color] }) as React.CSSProperties;

// The project's icon in its color, on a tint of it. Give it a size, and the glyph one too.
export function ProjectIcon({
  icon,
  color,
  className = "size-6 rounded-lg",
  glyphClassName = "size-3.5",
}: {
  icon: ProjectIconName;
  color: ProjectColor;
  className?: string;
  glyphClassName?: string;
}) {
  const Glyph = PROJECT_ICONS[icon];
  return (
    <span
      aria-hidden
      style={projectColorStyle(color)}
      className={`grid shrink-0 place-items-center project-tint project-glyph transition-colors ${className}`}
    >
      <Glyph className={glyphClassName} />
    </span>
  );
}
