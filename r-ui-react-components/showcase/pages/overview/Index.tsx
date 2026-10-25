import { Spotlight } from "../../../src/components/motion";
import { sectionIndex } from "../../registry";
import { groupIcon } from "../../shell/group-icons";
import { href } from "../../shell/router";
import { groupTitle } from "../../shell/sections";
import { Highlights } from "./Highlights";
import { OverviewHero } from "./OverviewHero";
import { groupSummary } from "./summaries";

const demos = (n: number) => `${n} ${n === 1 ? "demo" : "demos"}`;

/** `#/overview`: what the library is, then every group as a card. `unknown` is an anchor no group or section answers. */
export function Index({ unknown }: { unknown: string | null }) {
  return (
    <div className="sc-page">
      {unknown !== null && (
        <div className="sc-invalid" role="alert">
          <p>
            No group or section is named <code>{unknown}</code>.
          </p>
        </div>
      )}

      <OverviewHero />
      <Highlights />
      <h2 id="sc-group-index-title" className="mt-section-3 text-display-3">
        Every component, in every state
      </h2>

      {sectionIndex.length === 0 ? (
        <div className="sc-empty">
          <p>No component sections yet.</p>
          <p>
            Add <code>showcase/sections/&lt;group&gt;/&lt;Name&gt;.tsx</code> exporting <code>meta</code> and a
            default component.
          </p>
        </div>
      ) : (
        <ul className="sc-group-index" aria-labelledby="sc-group-index-title">
          {sectionIndex.map(({ group, ids }) => {
            const Icon = groupIcon(group);
            const summary = groupSummary(group);
            return (
              <li key={group}>
                <Spotlight as="a" className="sc-group-card" href={href("overview", group)}>
                  <span className="sc-group-card-icon" aria-hidden>
                    <Icon />
                  </span>
                  <span className="sc-group-card-title">{groupTitle(group)}</span>
                  {summary && <span className="sc-group-card-summary">{summary}</span>}
                  <span className="sc-group-card-count">{demos(ids.length)}</span>
                </Spotlight>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
