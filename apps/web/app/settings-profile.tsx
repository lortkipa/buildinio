"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CANCEL_BUTTON, SECONDARY_BUTTON } from "./buttons";
import { CircleAlertIcon } from "./icons";
import { FIELD, FormButtons, HINT, LABEL } from "./settings-parts";
import { type Account, Avatar, DEFAULT_AVATAR } from "./user-menu";

// The photos that can be picked, and how big. Shown whole in the circle, without cropping.
const PHOTO_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Same limit as the name on /welcome and in the API.
const MAX_NAME_LENGTH = 100;

/*
 * The user's photo, name and email. A picked photo shows right away, and Save turns on once
 * something changed, but nothing is saved yet: Save does nothing. The email can't be changed, as
 * accounts are keyed by it.
 */
export function ProfileTab({ user }: { user: Account["user"] }) {
  const photoHintId = useId();
  const nameId = useId();
  const nameHintId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  // The picture from Google or GitHub, or null for the default silhouette.
  const savedPhoto = user.image && user.image !== DEFAULT_AVATAR ? user.image : null;
  const [photo, setPhoto] = useState(savedPhoto);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Counts the photo's changes, which make it pop; none yet, so it doesn't pop as the tab shows.
  const [photoChanges, setPhotoChanges] = useState(0);
  const [name, setName] = useState(user.name);
  // A picked photo's blob URL, freed when another one takes its place or settings open again.
  const pickedRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (pickedRef.current) URL.revokeObjectURL(pickedRef.current);
    },
    [],
  );

  const trimmed = name.trim();
  const changed = trimmed !== user.name || photo !== savedPhoto;

  function showPhoto(url: string | null, picked = false) {
    if (pickedRef.current) URL.revokeObjectURL(pickedRef.current);
    pickedRef.current = picked ? url : null;
    setPhoto(url);
    setPhotoError(null);
    setPhotoChanges((count) => count + 1);
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // So picking the same file again still counts as a change.
    event.target.value = "";
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) setPhotoError("Pick a JPG, PNG, GIF or WebP image.");
    else if (file.size > MAX_PHOTO_BYTES) setPhotoError("Pick an image of 5 MB or less.");
    else showPhoto(URL.createObjectURL(file), true);
  }

  function cancel() {
    if (photo !== savedPhoto) showPhoto(savedPhoto);
    setPhotoError(null);
    setName(user.name);
  }

  return (
    // Not saved yet: Save does nothing.
    <form noValidate onSubmit={(event) => event.preventDefault()}>
      <div className="flex items-center gap-5">
        <input
          ref={fileRef}
          type="file"
          accept={PHOTO_TYPES.join(",")}
          tabIndex={-1}
          aria-hidden
          onChange={handleFile}
          className="sr-only"
        />
        {/* Pops each time it changes, but not as the tab shows. */}
        <span
          key={photoChanges}
          className={`block shrink-0 rounded-full ${
            photoChanges > 0 ? "animate-pick motion-reduce:animate-none" : ""
          }`}
        >
          <Avatar image={photo} size="size-20" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-describedby={photoHintId}
              className={SECONDARY_BUTTON}
            >
              Change photo
            </button>
            {photo && (
              <button type="button" onClick={() => showPhoto(null)} className={CANCEL_BUTTON}>
                Remove
              </button>
            )}
          </div>
          {photoError ? (
            <p
              id={photoHintId}
              role="alert"
              className="mt-2 flex items-start gap-1.5 text-xs text-pretty text-red-600 dark:text-red-400"
            >
              <CircleAlertIcon className="mt-px size-3.5 shrink-0" />
              {photoError}
            </p>
          ) : (
            <p id={photoHintId} className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              JPG, PNG, GIF or WebP, up to 5 MB.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-zinc-950/10 pt-6 dark:border-white/10">
        <label htmlFor={nameId} className={LABEL}>
          Name
        </label>
        <input
          id={nameId}
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="done"
          maxLength={MAX_NAME_LENGTH}
          placeholder="Your name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-describedby={nameHintId}
          className={`mt-2 ${FIELD}`}
        />
        <p id={nameHintId} className={`mt-2 ${HINT}`}>
          {trimmed === ""
            ? "Your name can’t be empty."
            : "Shown in the sidebar and on your home page."}
        </p>
      </div>

      <div className="mt-5">
        <p className={LABEL}>Email</p>
        <p className="mt-2 flex h-12 items-center rounded-2xl bg-zinc-950/5 px-4 text-base text-zinc-600 dark:bg-white/5 dark:text-zinc-300">
          <span className="min-w-0 flex-1 truncate-fade">{user.email}</span>
        </p>
        <p className={`mt-2 ${HINT}`}>You log in with this email, so it can’t be changed.</p>
      </div>

      <FormButtons changed={changed} canSave={changed && trimmed !== ""} onCancel={cancel} />
    </form>
  );
}
