import { use, useEffect } from "react";

import { loadSomeSections } from "../registry";
import type { PageProps } from "../shell/App";
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
      {(missing.length > 0 || invalid.length > 0 || ids.length === 0) && (
        <div className="sc-invalid" role="alert">
          <h2>Sections that could not load</h2>
          <ul>
            {ids.length === 0 && <li>No section named: use #/solo/&lt;group&gt;-&lt;file&gt;</li>}
            {missing.map((id) => (
              <li key={id}>
                <code>{id}</code>: no such section
              </li>
            ))}
            {invalid.map((i) => (
              <li key={i.path}>
                <code>{i.path}</code>: {i.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {ids.map((id) => {
        const section = byId.get(id);
        return section ? <SectionFrame key={id} section={section} /> : null;
      })}
      {runway && <div className="sc-solo-runway" aria-hidden />}
    </div>
  );
}
