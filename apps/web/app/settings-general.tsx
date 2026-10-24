"use client";

import { useId, useState } from "react";
import { CheckIcon, ChevronDownIcon, MonitorIcon, MoonIcon, SunIcon } from "./icons";
import { FIELD, SettingsGroup } from "./settings-parts";

type Theme = "system" | "light" | "dark";

const THEMES: { id: Theme; label: string; Icon: typeof SunIcon }[] = [
  { id: "system", label: "System", Icon: MonitorIcon },
  { id: "light", label: "Light", Icon: SunIcon },
  { id: "dark", label: "Dark", Icon: MoonIcon },
];

// Each in its own language, as someone looking for theirs would know it.
const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ka", name: "ქართული" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "it", name: "Italiano" },
  { code: "pt", name: "Português" },
  { code: "ru", name: "Русский" },
  { code: "uk", name: "Українська" },
  { code: "tr", name: "Türkçe" },
  { code: "pl", name: "Polski" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "zh-Hans", name: "简体中文" },
];

/*
 * The theme and the language. Picking one shows as picked, but changes nothing yet: the page
 * follows the system's light or dark setting (Tailwind's dark: variant is media-based), and is in
 * English.
 */
export function GeneralTab() {
  const name = useId();
  const languageId = useId();
  const [theme, setTheme] = useState<Theme>("system");
  const [language, setLanguage] = useState("en");

  return (
    <>
      <SettingsGroup title="Theme" description="How Buildinio looks. System follows your device.">
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
          {THEMES.map(({ id, label, Icon }) => (
            <label key={id} className="group/theme block cursor-pointer">
              <input
                type="radio"
                name={name}
                value={id}
                checked={theme === id}
                onChange={() => setTheme(id)}
                className="peer sr-only"
              />
              <span className="relative block overflow-hidden rounded-xl shadow-sm ring-1 ring-zinc-950/10 transition group-hover/theme:shadow-md peer-checked:ring-2 peer-checked:ring-brand-violet peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-brand-violet dark:ring-white/15">
                <ThemePreview theme={id} />
                <span className="absolute top-1.5 right-1.5 grid size-5 scale-50 place-items-center rounded-full bg-brand-violet text-white opacity-0 shadow-sm transition duration-300 ease-spring group-has-[:checked]/theme:scale-100 group-has-[:checked]/theme:opacity-100 motion-reduce:transition-none">
                  <CheckIcon className="size-3" />
                </span>
              </span>
              <span className="mt-2 flex items-center justify-center gap-1.5 text-sm font-medium text-zinc-600 transition-colors group-hover/theme:text-zinc-950 peer-checked:text-zinc-950 dark:text-zinc-300 dark:group-hover/theme:text-white dark:peer-checked:text-white">
                <Icon className="size-4 shrink-0" />
                {label}
              </span>
            </label>
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="Language"
        description="Buildinio’s menus and messages. Your apps can be in any language."
      >
        <label htmlFor={languageId} className="sr-only">
          Language
        </label>
        <div className="relative sm:max-w-xs">
          {/* A native select, so phones show their own picker. */}
          <select
            id={languageId}
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className={`${FIELD} cursor-pointer appearance-none pr-11 dark:[&_option]:bg-zinc-900`}
          >
            {LANGUAGES.map(({ code, name }) => (
              <option key={code} value={code} lang={code}>
                {name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
        </div>
      </SettingsGroup>
    </>
  );
}

// A small drawing of the app in a theme. System shows light and dark side by side.
function ThemePreview({ theme }: { theme: Theme }) {
  if (theme !== "system") return <Drawing dark={theme === "dark"} />;
  return (
    <span className="relative block">
      <Drawing dark={false} />
      <span className="absolute inset-0 [clip-path:inset(0_0_0_50%)]">
        <Drawing dark />
      </span>
    </span>
  );
}

// The sidebar with a few projects, and the headline over the prompt, on the page's glow. The page
// colors are --color-page's for each theme (globals.css), fixed here, as the page's own follow the
// system.
function Drawing({ dark }: { dark: boolean }) {
  const surface = dark ? "border-white/10 bg-zinc-900" : "border-zinc-950/10 bg-white";
  const line = dark ? "bg-white/15" : "bg-zinc-950/10";
  return (
    <span aria-hidden className={`flex aspect-[16/10] ${dark ? "bg-[#09090f]" : "bg-[#fffaf7]"}`}>
      <span className={`flex w-[28%] flex-col gap-1 border-r p-1.5 ${surface}`}>
        <span className={`h-1 w-3/5 rounded-full ${line}`} />
        <span className={`mt-1 h-1 w-4/5 rounded-full ${line}`} />
        <span className={`h-1 w-2/3 rounded-full ${line}`} />
        <span className={`h-1 w-3/4 rounded-full ${line}`} />
      </span>
      <span
        className="flex flex-1 flex-col items-center justify-center gap-1.5 p-2"
        style={{
          backgroundImage: `radial-gradient(70% 60% at 15% 100%, color-mix(in oklab, var(--color-brand-violet) ${dark ? 30 : 22}%, transparent), transparent), radial-gradient(60% 60% at 95% 0%, color-mix(in oklab, var(--color-brand-coral) ${dark ? 26 : 20}%, transparent), transparent)`,
        }}
      >
        <span className="h-1.5 w-1/2 rounded-full bg-brand-gradient" />
        <span className={`h-3.5 w-4/5 rounded-full border ${surface}`} />
      </span>
    </span>
  );
}
