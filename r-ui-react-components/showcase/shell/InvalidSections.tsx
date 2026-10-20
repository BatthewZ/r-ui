import type { ReactNode } from "react";

import type { InvalidSection } from "./sections";

/**
 * The alert a page that renders sections shows for those that could not load,
 * plus the page's own `notes` (one list item each); nothing when there are none.
 */
export function InvalidSections({ invalid, notes = [] }: { invalid: readonly InvalidSection[]; notes?: readonly { key: string; text: ReactNode }[] }) {
  if (invalid.length === 0 && notes.length === 0) return null;
  return (
    <div className="sc-invalid" role="alert">
      <h2>Sections that could not load</h2>
      <ul>
        {notes.map((n) => (
          <li key={n.key}>{n.text}</li>
        ))}
        {invalid.map((i) => (
          <li key={i.path}>
            <code>{i.path}</code>: {i.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
