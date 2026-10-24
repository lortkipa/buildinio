"use client";

import { useId, useState } from "react";
import { HINT } from "./settings-parts";

// The emails the user can turn off, and whether each starts on.
const EMAILS = [
  {
    id: "app-ready",
    title: "Your app is ready",
    description: "When Buildinio finishes building while you’re away.",
    on: true,
  },
  {
    id: "product-updates",
    title: "Product updates",
    description: "An email when Buildinio gets new features and improvements.",
    on: true,
  },
  {
    id: "tips",
    title: "Tips and ideas",
    description: "An email now and then with ways to get more out of Buildinio.",
    on: false,
  },
];

/*
 * Which emails Buildinio sends. The switches flip, and would save themselves, but nothing is saved
 * yet, and Buildinio sends none of these.
 */
export function NotificationsTab({ email }: { email: string }) {
  const [on, setOn] = useState(() => new Set(EMAILS.filter((e) => e.on).map((e) => e.id)));

  function toggle(id: string, checked: boolean) {
    setOn((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <>
      <p className={HINT}>
        Emails sent to{" "}
        <span className="font-medium wrap-anywhere text-zinc-950 dark:text-white">{email}</span>.
      </p>
      <ul className="mt-2 divide-y divide-zinc-950/10 dark:divide-white/10">
        {EMAILS.map(({ id, title, description }) => (
          <SwitchRow
            key={id}
            title={title}
            description={description}
            checked={on.has(id)}
            onChange={(checked) => toggle(id, checked)}
          />
        ))}
      </ul>
    </>
  );
}

function SwitchRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <li className="flex items-center gap-4 py-4">
      <div className="min-w-0 flex-1">
        <p id={`${id}-title`} className="text-sm font-medium">
          {title}
        </p>
        <p id={`${id}-description`} className={`mt-0.5 ${HINT}`}>
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onClick={() => onChange(!checked)}
        className="group/switch relative h-6 w-10 shrink-0 rounded-full bg-zinc-950/15 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet aria-checked:bg-brand-violet motion-reduce:transition-none dark:bg-white/20 dark:aria-checked:bg-brand-violet"
      >
        <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-spring group-aria-checked/switch:translate-x-4 motion-reduce:transition-none" />
      </button>
    </li>
  );
}
