import { useEffect } from "react";

/*
 * For a scrolling box with scroll-fade-edges (globals.css): marks the edges that have more content
 * beyond them, data-fade-top and data-fade-bottom, which fade out there. Kept up to date as the box
 * scrolls and as it or its content resizes.
 */
export function useScrollFade(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = box;
      // A pixel of slack: zoomed pages scroll in fractions.
      box.toggleAttribute("data-fade-top", scrollTop > 1);
      box.toggleAttribute("data-fade-bottom", scrollTop + clientHeight < scrollHeight - 1);
    };
    update();
    box.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(box);
    for (const child of box.children) resize.observe(child);
    return () => {
      box.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, [ref]);
}
