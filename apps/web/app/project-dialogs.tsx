"use client";

import { createContext, useCallback, useContext, useId, useState } from "react";
import { Dialog } from "./dialog";
import {
  COLOR_NAMES,
  ICON_NAMES,
  PROJECT_COLORS,
  PROJECT_ICONS,
  ProjectIcon,
  projectColorStyle,
} from "./project-icon";
import { deleteProject, type Project, renameProject, restyleProject } from "./projects";

/*
 * The dialogs a project's menu opens: changing its icon and color, renaming it, and deleting it.
 * AppShell renders them once, outside the sidebar and the phone sheet, so they can open above the
 * sheet (a later modal dialog goes on top).
 */

export type ProjectDialogKind = "icon" | "name" | "delete";

type OpenDialog = (kind: ProjectDialogKind, project: Project, returnFocus?: HTMLElement) => void;

const OpenDialogContext = createContext<OpenDialog>(() => {});

// Opens a dialog for a project. returnFocus: where focus goes when it closes, e.g. the menu's trigger.
export const useProjectDialogs = () => useContext(OpenDialogContext);

type Opened = {
  kind: ProjectDialogKind;
  // As it was when the dialog opened, so a deleted project still shows while the dialog closes.
  project: Project;
  returnFocus?: HTMLElement;
  // A new form, with fresh state, each time a dialog opens.
  key: number;
};

const DIALOG_WIDTH: Record<ProjectDialogKind, string> = {
  icon: "w-[min(calc(100%-2rem),27rem)]",
  name: "w-[min(calc(100%-2rem),24rem)]",
  delete: "w-[min(calc(100%-2rem),24rem)]",
};

export function ProjectDialogsProvider({ children }: { children: React.ReactNode }) {
  // The open dialog, or the last one while it animates out.
  const [opened, setOpened] = useState<Opened | null>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();

  const openDialog = useCallback<OpenDialog>((kind, project, returnFocus) => {
    setOpened((last) => ({ kind, project, returnFocus, key: (last?.key ?? 0) + 1 }));
    setOpen(true);
  }, []);

  function close() {
    setOpen(false);
    // The dialog would put focus back on the menu item that opened it, which is hidden by now.
    if (opened?.returnFocus?.isConnected) opened.returnFocus.focus();
  }

  return (
    <OpenDialogContext value={openDialog}>
      {children}
      {opened && (
        <Dialog
          open={open}
          onClose={close}
          className={DIALOG_WIDTH[opened.kind]}
          labelledBy={titleId}
        >
          {opened.kind === "name" && (
            <RenameForm
              key={opened.key}
              project={opened.project}
              titleId={titleId}
              onDone={close}
            />
          )}
          {opened.kind === "icon" && (
            <IconForm key={opened.key} project={opened.project} titleId={titleId} onDone={close} />
          )}
          {opened.kind === "delete" && (
            <DeleteForm
              key={opened.key}
              project={opened.project}
              titleId={titleId}
              onDone={close}
            />
          )}
        </Dialog>
      )}
    </OpenDialogContext>
  );
}

const TITLE = "font-display text-xl font-bold tracking-tight";
const BUTTON =
  "h-10 rounded-full px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet disabled:cursor-not-allowed disabled:opacity-40";
const CANCEL = `${BUTTON} text-zinc-700 hover:bg-zinc-950/5 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white`;
const PRIMARY = `${BUTTON} bg-zinc-950 text-white shadow-sm hover:bg-zinc-800 disabled:hover:bg-zinc-950 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:disabled:hover:bg-white`;
const DANGER = `${BUTTON} bg-red-600 text-white shadow-sm hover:bg-red-500`;

function Buttons({ onCancel, children }: { onCancel: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className={CANCEL}>
        Cancel
      </button>
      {children}
    </div>
  );
}

type FormProps = { project: Project; titleId: string; onDone: () => void };

function RenameForm({ project, titleId, onDone }: FormProps) {
  const id = useId();
  const [name, setName] = useState(project.name ?? "");
  const trimmed = name.trim();
  const canSave = trimmed !== "" && trimmed !== project.name;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSave) return;
        renameProject(project.id, trimmed);
        onDone();
      }}
      className="p-5"
    >
      <h2 id={titleId} className={TITLE}>
        Rename project
      </h2>
      <label htmlFor={id} className="sr-only">
        Name
      </label>
      {/* text-base: iOS zooms into fields with smaller text. */}
      <input
        id={id}
        data-autofocus
        type="text"
        autoComplete="off"
        enterKeyHint="done"
        maxLength={60}
        placeholder="Project name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        style={projectColorStyle(project.color)}
        className="mt-4 h-12 w-full rounded-2xl border border-zinc-950/10 bg-white px-4 text-base outline-none transition-colors placeholder:text-zinc-500 focus:border-(--project) dark:border-white/10 dark:bg-zinc-950/40 dark:placeholder:text-zinc-400 dark:focus:border-(--project)"
      />
      <Buttons onCancel={onDone}>
        <button type="submit" disabled={!canSave} className={PRIMARY}>
          Save
        </button>
      </Buttons>
    </form>
  );
}

const label = (key: string) =>
  key.charAt(0).toUpperCase() + key.slice(1).replace(/-\d*$/, "").replace(/-/g, " ");

// The icon and its color, picked from PROJECT_ICONS and PROJECT_COLORS, with a preview on top.
function IconForm({ project, titleId, onDone }: FormProps) {
  const [icon, setIcon] = useState(project.icon);
  const [color, setColor] = useState(project.color);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        restyleProject(project.id, icon, color);
        onDone();
      }}
      className="p-5"
    >
      <div className="flex items-center gap-4">
        {/* Pops each time the icon or color changes. */}
        <ProjectIcon
          key={`${icon}-${color}`}
          icon={icon}
          color={color}
          className="size-14 animate-pick rounded-2xl motion-reduce:animate-none"
          glyphClassName="size-7"
        />
        {/* Fills the row, so the name fades out only when too long to fit. */}
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className={TITLE}>
            Change icon
          </h2>
          <p className="truncate-fade text-sm text-zinc-600 dark:text-zinc-300">{project.name}</p>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Icon</legend>
        <div
          style={projectColorStyle(color)}
          className="mt-2 grid grid-cols-6 gap-1.5 sm:grid-cols-8"
        >
          {ICON_NAMES.map((name) => {
            const Glyph = PROJECT_ICONS[name];
            return (
              <label key={name} className="relative grid aspect-square place-items-center">
                <input
                  type="radio"
                  name="icon"
                  value={name}
                  checked={icon === name}
                  onChange={() => setIcon(name)}
                  aria-label={label(name)}
                  className="peer sr-only"
                />
                <span className="grid size-full cursor-pointer place-items-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 peer-checked:animate-pick peer-checked:project-tint peer-checked:project-glyph peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-violet motion-reduce:peer-checked:animate-none dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white">
                  <Glyph className="size-5" />
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Color</legend>
        <div className="mt-2 grid grid-cols-10 gap-1.5">
          {COLOR_NAMES.map((name) => (
            <label key={name} className="relative grid aspect-square place-items-center">
              <input
                type="radio"
                name="color"
                value={name}
                checked={color === name}
                onChange={() => setColor(name)}
                aria-label={label(name)}
                className="peer sr-only"
              />
              <span
                style={{ backgroundColor: PROJECT_COLORS[name] }}
                className="aspect-square w-full max-w-7 cursor-pointer rounded-full shadow-inner ring-offset-2 ring-offset-white transition hover:scale-110 peer-checked:animate-pick peer-checked:ring-2 peer-checked:ring-zinc-950/70 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-brand-violet motion-reduce:peer-checked:animate-none dark:ring-offset-zinc-900 dark:peer-checked:ring-white/80"
              />
            </label>
          ))}
        </div>
      </fieldset>

      <Buttons onCancel={onDone}>
        <button
          type="submit"
          disabled={icon === project.icon && color === project.color}
          className={PRIMARY}
        >
          Save
        </button>
      </Buttons>
    </form>
  );
}

function DeleteForm({ project, titleId, onDone }: FormProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        // An open project's page notices and goes home (ProjectChat).
        deleteProject(project.id);
        onDone();
      }}
      className="p-5"
    >
      <h2 id={titleId} className={TITLE}>
        Delete project?
      </h2>
      {/* wrap-anywhere: a long name without spaces wraps instead of widening the dialog. */}
      <p className="mt-2 text-sm text-pretty wrap-anywhere text-zinc-600 dark:text-zinc-300">
        <span className="font-medium text-zinc-950 dark:text-white">
          {project.name ?? "This project"}
        </span>{" "}
        and its chat will be deleted. This can’t be undone.
      </p>
      <Buttons onCancel={onDone}>
        <button type="submit" className={DANGER}>
          Delete
        </button>
      </Buttons>
    </form>
  );
}
