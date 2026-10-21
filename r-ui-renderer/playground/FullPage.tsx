import { Alert } from "@batthewz/r-ui-react-components";
import { useMemo } from "react";

import { corpusDocument } from "./corpus";
import { DocumentView, StreamedView } from "./DocumentView";
import type { ViewRoute } from "./route";
import { usePageMarkers } from "./settle";

/** `/?view=<name>`: one corpus document, full-page, no chrome. */
export function FullPage({ route }: { readonly route: ViewRoute }) {
  const entry = useMemo(() => corpusDocument(route.name), [route.name]);
  if (!entry.ok) return <RouteError code={entry.code} message={entry.message} />;
  return (
    <main>
      {route.stream === undefined ? (
        <DocumentView input={{ spec: entry.spec }} complete density={route.density} />
      ) : (
        <StreamedView text={entry.text} charsPerFrame={route.stream} density={route.density} />
      )}
    </main>
  );
}

/** A route that cannot render: settled at once, with `<html data-renderer-error="<code>">` for the checks. */
export function RouteError({ code, message }: { readonly code: string; readonly message: string }) {
  usePageMarkers(true, code);
  return (
    <main className="pg-route-error">
      <Alert tone="error" title="This view cannot be shown">
        {message}
      </Alert>
    </main>
  );
}
