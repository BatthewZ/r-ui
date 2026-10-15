"use client";
import { useEffect, useRef, useState } from "react";

export interface UseActiveSectionOptions {
  /**
   * The observer's `rootMargin`: the band of the viewport a section must reach
   * to count as visible. The default is the top 60% of the viewport. Under a
   * sticky header, pass the header's height as a negative top margin
   * (`"-64px 0px -40% 0px"`), measured from the rendered header:
   * IntersectionObserver takes px and % only, never a `var()`.
   */
  rootMargin?: string;
}

const DEFAULT_ROOT_MARGIN = "0px 0px -40% 0px";

/**
 * Tracks which section is currently visible using IntersectionObserver.
 * Returns the id of the first visible section in the order given (list them in
 * document order). Once a section has been active it stays so until another
 * becomes visible, so a gap between sections keeps the last one. Ids with no
 * element are skipped. An equal list passed as a new array does not re-observe;
 * a new `rootMargin` does.
 */
export function useActiveSection(
  sectionIds: readonly string[],
  { rootMargin = DEFAULT_ROOT_MARGIN }: UseActiveSectionOptions = {},
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const visibleSet = useRef(new Set<string>());
  const idsKey = sectionIds.join("\u0000");

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    visibleSet.current.clear();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSet.current.add(entry.target.id);
          } else {
            visibleSet.current.delete(entry.target.id);
          }
        }

        // Pick the first visible section in document order
        for (const id of sectionIds) {
          if (visibleSet.current.has(id)) {
            setActiveId(id);
            return;
          }
        }
      },
      { rootMargin },
    );

    for (const el of elements) {
      observer.observe(el);
    }

    return () => observer.disconnect();
    // Keyed on the ids' content: an inline array literal must not re-observe every render.
  }, [idsKey, rootMargin]);

  return activeId;
}
