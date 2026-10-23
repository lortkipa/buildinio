import { useEffect } from "react";

/*
 * For a scrolling box with scroll-fade-edges or, scrolling sideways (axis "x"), scroll-fade-x
 * (globals.css): marks the edges that have more content beyond them, data-fade-top and
 * data-fade-bottom or data-fade-left and data-fade-right, which fade out there. Kept up to date as
 * the box scrolls and as it or its content resizes.
 */
export function useScrollFade(ref: React.RefObject<HTMLElement | null>, axis: "x" | "y" = "y") {
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const update = () => {
      // A pixel of slack: zoomed pages scroll in fractions.
      if (axis === "x") {
        const { scrollLeft, scrollWidth, clientWidth } = box;
        box.toggleAttribute("data-fade-left", scrollLeft > 1);
        box.toggleAttribute("data-fade-right", scrollLeft + clientWidth < scrollWidth - 1);
      } else {
        const { scrollTop, scrollHeight, clientHeight } = box;
        box.toggleAttribute("data-fade-top", scrollTop > 1);
        box.toggleAttribute("data-fade-bottom", scrollTop + clientHeight < scrollHeight - 1);
      }
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
  }, [ref, axis]);
}
