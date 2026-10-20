import { use, useEffect } from "react";

import { loadSections } from "../registry";
import type { PageProps } from "../shell/App";
import { groupTitle } from "../shell/sections";
import { InvalidSections } from "../shell/InvalidSections";
import { SectionFrame } from "../shell/SectionFrame";

/**
 * Every section of every group on one page (`#/all[/<id>]`), for the sweeps and
 * `browser:check --all`: they measure each section among all the others, which
 * the paged Overview no longer shows together. Not in the navigation.
 */
export function All({ anchor }: PageProps) {
  const { groups, invalid } = use(loadSections());

  useEffect(() => {
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: "start" });
  }, [anchor]);

  return (
    <div className="sc-page">
      <header className="sc-page-head">
        <h1>All sections</h1>
      </header>
      <InvalidSections invalid={invalid} />
      {groups.map(({ group, sections: list }) => (
        <section key={group} className="sc-group" aria-labelledby={`group-${group}`}>
          <h2 id={`group-${group}`}>{groupTitle(group)}</h2>
          {list.map((section) => (
            <SectionFrame key={section.id} section={section} />
          ))}
        </section>
      ))}
    </div>
  );
}
