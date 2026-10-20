import { use, useEffect, useMemo, useRef, useState } from "react";

import { useActiveSection } from "../../src/hooks/use-active-section";
import { usePrefersReducedMotion } from "../../src/hooks/use-reduced-motion";

import { loadGroupSections, sectionIndex } from "../registry";
import type { PageProps } from "../shell/App";
import { InvalidSections } from "../shell/InvalidSections";
import { href } from "../shell/router";
import { groupTitle, resolveOverview } from "../shell/sections";
import { SectionFrame } from "../shell/SectionFrame";

const demos = (n: number) => `${n} ${n === 1 ? "demo" : "demos"}`;

/**
 * The component demos, one group to a page: `#/overview` is the index of
 * groups, `#/overview/<group>` a group's page, and `#/overview/<section id>`
 * that section on its group's page. Groups and sections are discovered from
 * `showcase/sections/<group>/*.tsx`; nothing here changes when one is added.
 */
export function Overview({ anchor }: PageProps) {
  const target = resolveOverview(sectionIndex, anchor);
  return target.kind === "group" ? (
    <GroupPage group={target.group} section={target.section} />
  ) : (
    <Index unknown={target.kind === "unknown" ? target.anchor : null} />
  );
}

function Index({ unknown }: { unknown: string | null }) {
  return (
    <div className="sc-page">
      <header className="sc-page-head">
        <h1>Overview</h1>
        <p className="sc-lede">
          Every component, in every state, a group to a page. Flip theme, density and input from View; resize a demo
          to see its container queries.
        </p>
      </header>

      {unknown !== null && (
        <div className="sc-invalid" role="alert">
          <p>
            No group or section is named <code>{unknown}</code>.
          </p>
        </div>
      )}

      {sectionIndex.length === 0 ? (
        <div className="sc-empty">
          <p>No component sections yet.</p>
          <p>
            Add <code>showcase/sections/&lt;group&gt;/&lt;Name&gt;.tsx</code> exporting <code>meta</code> and a
            default component.
          </p>
        </div>
      ) : (
        <ul className="sc-group-index" aria-label="Component groups">
          {sectionIndex.map(({ group, ids }) => (
            <li key={group}>
              <a className="sc-group-card" href={href("overview", group)}>
                <span className="sc-group-card-title">{groupTitle(group)}</span>
                <span className="sc-group-card-count">{demos(ids.length)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Which section the reader is in: the first one in the band from under the sticky
 * header to 40% down the viewport. At the page's end, where short last sections can
 * never reach that band, the last one on screen. Before any reading, `fallback`.
 */
function useReadingSection(ids: readonly string[], fallback: string | null): string | null {
  // The observer takes px, never a var(): read the header's clearance once, as rendered.
  const [clearance, setClearance] = useState<number | null>(null);
  useEffect(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;block-size:var(--sc-header-clearance)";
    (document.querySelector(".sc-page") ?? document.body).append(probe);
    setClearance(probe.getBoundingClientRect().height);
    probe.remove();
  }, []);
  const inBand = useActiveSection(clearance === null ? [] : ids, { rootMargin: `-${clearance ?? 0}px 0px -60% 0px` });

  const [atEnd, setAtEnd] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      const root = document.documentElement;
      if (root.scrollHeight - window.innerHeight - window.scrollY > 2) return setAtEnd(null);
      const onScreen = ids.filter((id) => {
        const r = document.getElementById(id)?.getBoundingClientRect();
        return r !== undefined && r.top < window.innerHeight && r.bottom > 0;
      });
      setAtEnd(onScreen.at(-1) ?? null);
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, [ids]);

  return atEnd ?? inBand ?? fallback;
}

/**
 * One group's sections, and only theirs loaded. The contents rail comes first
 * in reading order and, on a wide page, stays beside the sections as they scroll,
 * marking the one being read and keeping it in its own view.
 */
function GroupPage({ group, section }: { group: string; section: string | null }) {
  const { groups, invalid } = use(loadGroupSections(group));
  const sections = groups[0]?.sections ?? [];
  const ids = useMemo(() => sections.map((s) => s.id), [sections]);
  const reading = useReadingSection(ids, section);
  const rail = useRef<HTMLElement>(null);
  // Read when a link changes, not a reason to scroll again when the preference does.
  const reduced = useRef(false);
  reduced.current = usePrefersReducedMotion();
  // While a press glides the page to its section, the rail holds that section
  // rather than marking each one the page passes on the way.
  const [gliding, setGliding] = useState<string | null>(null);
  const shown = useRef<{ group: string; section: string | null } | null>(null);

  // Keep the current entry inside the rail when the rail scrolls (a long group,
  // wide): move the rail only, never the page.
  useEffect(() => {
    const box = rail.current;
    const entry = box?.querySelector<HTMLElement>('a[aria-current="location"]');
    if (!box || !entry || box.scrollHeight <= box.clientHeight) return;
    const b = box.getBoundingClientRect();
    const e = entry.getBoundingClientRect();
    if (e.top < b.top) box.scrollTop -= b.top - e.top;
    else if (e.bottom > b.bottom) box.scrollTop += e.bottom - b.bottom;
  }, [reading, gliding]);

  // A group starts at its top; a section link lands on that section, gliding there
  // when it was pressed on this group's page (not on arriving, not under reduced motion).
  useEffect(() => {
    const before = shown.current;
    shown.current = { group, section };
    const target = section ? document.getElementById(section) : null;
    if (!target) {
      window.scrollTo({ top: 0 });
      return;
    }
    const glide = before?.group === group && !reduced.current;
    target.scrollIntoView({ block: "start", behavior: glide ? "smooth" : "instant" });
    if (!glide) return;
    setGliding(section);
    const done = () => setGliding(null);
    // `scrollend` where it exists; a timer where it does not, or where nothing moved.
    window.addEventListener("scrollend", done, { once: true });
    const fallback = window.setTimeout(done, 1500);
    return () => {
      window.removeEventListener("scrollend", done);
      window.clearTimeout(fallback);
    };
  }, [group, section]);

  const at = sectionIndex.findIndex((g) => g.group === group);
  const previous = sectionIndex[at - 1];
  const next = sectionIndex[at + 1];

  return (
    <div className="sc-page">
      <header className="sc-page-head">
        <p className="sc-crumb">
          <a href={href("overview")}>Overview</a>
        </p>
        <h1>{groupTitle(group)}</h1>
      </header>

      <InvalidSections invalid={invalid} />

      <div className="@container min-w-0">
        <div className="sc-group-layout @4xl:grid-cols-[minmax(0,1fr)_var(--COLUMN-SM)]">
          <nav ref={rail} className="sc-rail @4xl:col-start-2 @4xl:row-start-1" aria-label="On this page">
            <ul>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={href("overview", s.id)} aria-current={s.id === (gliding ?? reading) ? "location" : undefined}>
                    {s.meta.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="sc-group @4xl:col-start-1 @4xl:row-start-1">
            {sections.map((s) => (
              <SectionFrame key={s.id} section={s} level={2} />
            ))}
          </div>
        </div>
      </div>

      {(previous || next) && (
        <nav className="sc-pager" aria-label="Component groups">
          {previous && (
            <a href={href("overview", previous.group)} rel="prev">
              <span className="sc-pager-hint">Previous</span>
              {groupTitle(previous.group)}
            </a>
          )}
          {next && (
            <a href={href("overview", next.group)} rel="next" className="sc-pager-next">
              <span className="sc-pager-hint">Next</span>
              {groupTitle(next.group)}
            </a>
          )}
        </nav>
      )}
    </div>
  );
}
