"use client";

import { useId, useRef, useState } from "react";
import { DIALOG_TITLE, Dialog } from "./dialog";
import { ICON_BUTTON } from "./icon-button";
import { BellIcon, ShieldCheckIcon, SlidersHorizontalIcon, UserRoundIcon, XIcon } from "./icons";
import { useScrollFade } from "./scroll-fade";
import { AccountTab, DeleteAccountDialog } from "./settings-account";
import { GeneralTab } from "./settings-general";
import { NotificationsTab } from "./settings-notifications";
import { ProfileTab } from "./settings-profile";
import type { Account } from "./user-menu";
import { useWide } from "./wide";

const TABS = [
  { id: "profile", label: "Profile", Icon: UserRoundIcon },
  { id: "general", label: "General", Icon: SlidersHorizontalIcon },
  { id: "notifications", label: "Notifications", Icon: BellIcon },
  { id: "account", label: "Account", Icon: ShieldCheckIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

// From md up, a list in the left column. On phones, a row of chips under the title that scrolls
// sideways, the picked one filled in.
const TAB =
  "flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium whitespace-nowrap text-zinc-700 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet aria-selected:bg-zinc-950/5 aria-selected:text-zinc-950 max-md:aria-selected:bg-zinc-950 max-md:aria-selected:text-white md:h-10 md:w-full md:gap-3 md:rounded-xl md:px-2.5 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white dark:aria-selected:bg-white/10 dark:aria-selected:text-white dark:max-md:aria-selected:bg-white dark:max-md:aria-selected:text-zinc-950";

/*
 * Settings, from the account menu: the user's profile, the theme and language, email
 * notifications, and the account (devices, and deleting it). Over the page from md up, with the tabs
 * in a left column; full screen on phones. Only deleting the account works yet: the rest shows what
 * it would change but saves nothing (see each tab). AppShell renders it once, after the phone sheet,
 * so it opens above it.
 *
 * session: a new number each time it opens, which starts it over on the first tab.
 */
export function SettingsDialog({
  open,
  session,
  user,
  onClose,
}: {
  open: boolean;
  session: number;
  user: Account["user"];
  onClose: () => void;
}) {
  const titleId = useId();
  // Confirming the account's deletion, in a dialog of its own over this one: beside it rather than
  // inside it, so closing it doesn't reach this dialog's onClose too.
  const [deleting, setDeleting] = useState({ open: false, session: 0 });

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        labelledBy={titleId}
        // A fixed height, so it doesn't jump between tabs. Shorter while a phone keyboard is up.
        className="h-[min(calc(100dvh-var(--keyboard-inset,0px)-2rem),40rem)] w-[min(calc(100%-2rem),52rem)] max-md:m-0 max-md:h-[calc(100dvh-var(--keyboard-inset,0px))] max-md:max-h-none max-md:w-full max-md:rounded-none max-md:border-0 max-md:shadow-none"
      >
        <SettingsPanel
          key={session}
          titleId={titleId}
          user={user}
          onClose={onClose}
          onDeleteAccount={() =>
            setDeleting(({ session }) => ({ open: true, session: session + 1 }))
          }
        />
      </Dialog>
      <DeleteAccountDialog
        open={deleting.open}
        session={deleting.session}
        email={user.email}
        onClose={() => setDeleting(({ session }) => ({ open: false, session }))}
      />
    </>
  );
}

function SettingsPanel({
  titleId,
  user,
  onClose,
  onDeleteAccount,
}: {
  titleId: string;
  user: Account["user"];
  onClose: () => void;
  onDeleteAccount: () => void;
}) {
  const id = useId();
  const wide = useWide();
  const [selected, setSelected] = useState<TabId>("profile");
  const tabsRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);
  useScrollFade(tabsRef, "x");
  useScrollFade(panelsRef);

  const tabId = (tab: TabId) => `${id}-${tab}-tab`;
  const panelId = (tab: TabId) => `${id}-${tab}-panel`;
  const current = TABS.find((tab) => tab.id === selected) ?? TABS[0];

  function select(tab: TabId) {
    setSelected(tab);
    // Each tab starts at its top.
    panelsRef.current?.scrollTo({ top: 0 });
    // On phones, a chip partly scrolled out of the row comes in, clear of the fade (scroll-px-8).
    document.getElementById(tabId(tab))?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  // The arrows (either way, as the tabs are a column or a row), Home and End pick a tab.
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = TABS.findIndex((tab) => tab.id === selected);
    let next: number;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    const tab = TABS[next]?.id;
    if (!tab) return;
    select(tab);
    document.getElementById(tabId(tab))?.focus();
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="flex shrink-0 flex-col md:w-56 md:border-r md:border-zinc-950/10 md:bg-zinc-950/[0.025] md:dark:border-white/10 md:dark:bg-white/[0.03]">
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 pr-3 pl-5">
          <h2 id={titleId} className={DIALOG_TITLE}>
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className={`${ICON_BUTTON} md:hidden`}
          >
            <XIcon className="size-5" />
          </button>
        </div>
        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Settings"
          aria-orientation={wide ? "vertical" : "horizontal"}
          onKeyDown={handleKeyDown}
          className="flex scroll-px-8 gap-1.5 overflow-x-auto overscroll-x-contain px-4 pt-0.5 pb-3 [scrollbar-width:none] motion-safe:scroll-smooth max-md:scroll-fade-x max-md:[--fade-size:2rem] md:flex-col md:gap-0.5 md:overflow-visible md:px-2 [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map(({ id: tab, label, Icon }) => (
            <button
              key={tab}
              id={tabId(tab)}
              type="button"
              role="tab"
              aria-selected={tab === selected}
              aria-controls={panelId(tab)}
              // Only the picked tab is in the Tab order; the arrows move between them.
              tabIndex={tab === selected ? 0 : -1}
              onClick={() => select(tab)}
              className={TAB}
            >
              <Icon className="size-4 shrink-0 md:size-5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* On phones the picked chip names the tab, so this heading is only for screen readers. */}
        <div className="flex shrink-0 items-center justify-between gap-2 pr-3 pl-6 md:h-16">
          <h3 className="font-display text-lg font-bold tracking-tight max-md:sr-only">
            {current.label}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className={`${ICON_BUTTON} max-md:hidden`}
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Every tab stays mounted, so what was typed in one is still there after visiting another. */}
        <div
          ref={panelsRef}
          className="prompt-scrollbar scroll-fade-edges min-h-0 flex-1 overflow-y-auto overscroll-contain [--fade-size:1.5rem]"
        >
          {TABS.map(({ id: tab }) => (
            <div
              key={tab}
              id={panelId(tab)}
              role="tabpanel"
              aria-labelledby={tabId(tab)}
              hidden={tab !== selected}
              className="px-5 pt-3 pb-8 md:px-6 md:pt-1"
            >
              {tab === "profile" && <ProfileTab user={user} />}
              {tab === "general" && <GeneralTab />}
              {tab === "notifications" && <NotificationsTab email={user.email} />}
              {tab === "account" && <AccountTab onDeleteAccount={onDeleteAccount} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
