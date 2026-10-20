import { use, useEffect } from "react";

import { loadSomeSections } from "../registry";
import type { PageProps } from "../shell/App";
import { InvalidSections } from "../shell/InvalidSections";
import { parseSoloAnchor } from "../shell/router";
import { SectionFrame } from "../shell/SectionFrame";

/**
 * Only the sections the hash names (`#/solo/<id>[,<id>…][?runway]`), in that
 * order, with the Overview's exact section markup, loading only their chunks.
 * The browser checks open a section here instead of on the Overview, whose
 * every section they would otherwise load and lay out. Not in the navigation.
 */
export function Solo({ anchor }: PageProps) {
  const { ids, runway } = parseSoloAnchor(anchor);
  const { groups, invalid, missing } = use(loadSomeSections(ids));
  const byId = new Map(groups.flatMap((g) => g.sections).map((s) => [s.id, s]));
  const key = ids.join(",");

  // The checks wait for the list they asked for, so a stale page never answers for a new one.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.showcaseSolo = key;
    return () => {
      delete root.dataset.showcaseSolo;
    };
  }, [key]);

  return (
    <div className="sc-page">
      {runway && <div className="sc-solo-runway" aria-hidden />}
      <InvalidSections
        invalid={invalid}
        notes={[
          ...(ids.length === 0 ? [{ key: "none", text: "No section named: use #/solo/<group>-<file>" }] : []),
          ...missing.map((id) => ({ key: id, text: <><code>{id}</code>: no such section</> })),
        ]}
      />
      {ids.map((id) => {
        const section = byId.get(id);
        return section ? <SectionFrame key={id} section={section} /> : null;
      })}
      {runway && <div className="sc-solo-runway" aria-hidden />}
    </div>
  );
}
