/*
 * Phone keyboards cover the page instead of resizing it (only the visual viewport shrinks), and
 * browsers scroll just the caret into view, so the rest of a form can end up under the keyboard.
 * revealForm keeps the whole form, submit button included, in the visible area. Call it while a
 * field in the form is focused, on the visual viewport's resize event (the keyboard opening) and
 * whenever the form's height changes.
 */

// Space kept between the form and the keyboard or the screen edge. Give the form scroll-my-4 to match.
export const VIEWPORT_GAP = 16;

// How far the form's bottom (positive) or top (negative) sticks out of the visible area, else 0.
function formOverflow(form: HTMLFormElement, viewport: VisualViewport) {
  const { top, bottom } = form.getBoundingClientRect();
  const below = bottom - (viewport.offsetTop + viewport.height - VIEWPORT_GAP);
  const above = viewport.offsetTop + VIEWPORT_GAP - top;
  // If the form can't fit, the bottom wins: it has the submit button, and the caret is usually there.
  if (below > 0) return below;
  if (above > 0) return -above;
  return 0;
}

// Scroll the page by the least amount that shows the whole form.
export function revealForm(form: HTMLFormElement) {
  const viewport = window.visualViewport;
  if (viewport?.scale !== 1) return;
  const overflow = formOverflow(form, viewport);
  if (overflow === 0) return;
  // Not window.scrollBy: Chrome on Android applies it to the layout viewport only, which the
  // keyboard doesn't shrink, so a page that fits the screen can't scroll. scrollIntoView also
  // pans the visual viewport.
  form.scrollIntoView({ block: overflow > 0 ? "end" : "start" });
  // A browser whose scrollIntoView ignores the keyboard leaves the rest to window scrolling.
  const rest = formOverflow(form, viewport);
  if (Math.abs(rest) >= 1) window.scrollBy(0, rest);
}
