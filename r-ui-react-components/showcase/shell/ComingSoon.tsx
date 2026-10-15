interface ComingSoonProps {
  title: string;
  children: React.ReactNode;
}

/** Placeholder for a page a later wave builds. Says what will be here. */
export function ComingSoon({ title, children }: ComingSoonProps) {
  return (
    <div className="sc-page">
      <header className="sc-page-head">
        <h1>{title}</h1>
        <p className="sc-lede">Coming soon.</p>
      </header>
      <div className="sc-empty">{children}</div>
    </div>
  );
}
