import { use, useEffect } from "react";

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
 * One group's sections, and only theirs loaded. The contents rail comes first
 * in reading order and, on a wide page, stays beside the sections as they scroll.
 */
function GroupPage({ group, section }: { group: string; section: string | null }) {
  const { groups, invalid } = use(loadGroupSections(group));
  const sections = groups[0]?.sections ?? [];

  // A group starts at its top; a section link lands on that section.
  useEffect(() => {
    if (section) document.getElementById(section)?.scrollIntoView({ block: "start" });
    else window.scrollTo({ top: 0 });
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
          <nav className="sc-rail @4xl:col-start-2 @4xl:row-start-1" aria-label="On this page">
            <ul>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={href("overview", s.id)} aria-current={s.id === section ? "location" : undefined}>
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
