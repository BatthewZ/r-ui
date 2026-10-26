/**
 * The label over one variant inside a demo. Labels read "Name · notes · more
 * notes": the name before the first " · " is what a reader scans for, so it
 * leads and the notes recede.
 */
export function DemoLabel({ children }: { children: string }) {
  const at = children.indexOf(SEPARATOR);
  return (
    <p className="sc-demo-label">
      {at === -1 ? (
        children
      ) : (
        <>
          {children.slice(0, at)}
          <span className="sc-demo-label-notes">{children.slice(at)}</span>
        </>
      )}
    </p>
  );
}

const SEPARATOR = " · ";
