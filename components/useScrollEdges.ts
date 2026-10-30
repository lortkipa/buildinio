import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Marks whether a scroll area is at its top and bottom (`data-top`, `data-bottom`), and
 * its left and right (`data-left`, `data-right`), for the `.fade-y` and `.fade-x` masks in
 * globals.css. Set on the element itself, so scrolling doesn't re-render. Its first child
 * is watched too: content growing moves the bottom (or the right).
 */
export function useScrollEdges(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      el.dataset.top = String(el.scrollTop <= 1);
      el.dataset.bottom = String(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
      el.dataset.left = String(el.scrollLeft <= 1);
      el.dataset.right = String(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [ref]);
}
