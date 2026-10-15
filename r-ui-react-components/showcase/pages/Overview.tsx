import { useEffect } from "react";

import { sections } from "../registry";
import type { PageProps } from "../shell/App";
import { href } from "../shell/router";
import { SectionBoundary } from "../shell/SectionBoundary";

const groupTitle = (group: string) => group.charAt(0).toUpperCase() + group.slice(1);

/**
 * Every component demo, discovered from `showcase/sections/<group>/*.tsx`,
 * grouped and ordered by each file's `meta`. Nothing here changes when a
 * section is added.
 */
export function Overview({ anchor }: PageProps) {
  const { groups, invalid } = sections;

  useEffect(() => {
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: "start" });
  }, [anchor]);

  return (
    <div className="sc-page">
      <header className="sc-page-head">
        <h1>Overview</h1>
        <p className="sc-lede">
          Every component, in every state. Flip theme, density and input from View; resize a demo
          to see its container queries.
        </p>
      </header>

      {invalid.length > 0 && (
        <div className="sc-invalid" role="alert">
          <h2>Sections that could not load</h2>
          <ul>
            {invalid.map((i) => (
              <li key={i.path}>
                <code>{i.path}</code>: {i.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="sc-empty">
          <p>No component sections yet.</p>
          <p>
            Add <code>showcase/sections/&lt;group&gt;/&lt;Name&gt;.tsx</code> exporting{" "}
            <code>meta</code> and a default component.
          </p>
        </div>
      ) : (
        <>
          <nav className="sc-toc" aria-label="On this page">
            {groups.map(({ group, sections: list }) => (
              <div key={group}>
                <h2 className="sc-toc-group">{groupTitle(group)}</h2>
                <ul>
                  {list.map((s) => (
                    <li key={s.id}>
                      <a href={href("overview", s.id)}>{s.meta.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {groups.map(({ group, sections: list }) => (
            <section key={group} className="sc-group" aria-labelledby={`group-${group}`}>
              <h2 id={`group-${group}`}>{groupTitle(group)}</h2>
              {list.map(({ id, meta, Component }) => (
                <section key={id} id={id} className="sc-section" aria-labelledby={`${id}-title`}>
                  <header>
                    <h3 id={`${id}-title`}>{meta.title}</h3>
                    {meta.description && <p>{meta.description}</p>}
                  </header>
                  <div className="sc-demo">
                    <SectionBoundary title={meta.title}>
                      <Component />
                    </SectionBoundary>
                  </div>
                </section>
              ))}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
