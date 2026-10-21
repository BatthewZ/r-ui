import { ToastProvider } from "@batthewz/r-ui-react-components";

import { FullPage, RouteError } from "./FullPage";
import { Playground } from "./Playground";
import type { Route } from "./route";

export function App({ route }: { readonly route: Route }) {
  return (
    <ToastProvider>
      {route.kind === "view" ? (
        <FullPage route={route} />
      ) : route.kind === "invalid" ? (
        <RouteError code="invalid-route" message={route.message} />
      ) : (
        <Playground />
      )}
    </ToastProvider>
  );
}
