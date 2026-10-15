import { type ComponentPropsWithRef, createContext, type MouseEvent, type ReactNode, useCallback, useContext, useState } from "react";

import { RouterProvider } from "../../../../src/components/navigation";

const NavigateContext = createContext<(href: string) => void>(() => {});

/**
 * A stand-in for an app's router, so demos can show real links being followed
 * without leaving the page: it keeps a location in state and its link
 * component navigates in place, as a client-side router's would.
 */
export function DemoLink({ href, onClick, ...props }: ComponentPropsWithRef<"a">) {
  const navigate = useContext(NavigateContext);
  return (
    <a
      href={href}
      data-demo-router=""
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented || !href) return;
        event.preventDefault();
        navigate(href);
      }}
      {...props}
    />
  );
}

/** Provides the demo location to `children` and configures the library's RouterProvider once. */
export function DemoRouter({ initial, children }: { initial: string; children: (location: URL) => ReactNode }) {
  const [location, setLocation] = useState(initial);
  const url = new URL(location, "https://demo.invalid");
  const isCurrent = useCallback((href: string) => new URL(href, "https://demo.invalid").pathname === new URL(location, "https://demo.invalid").pathname, [location]);
  return (
    <NavigateContext value={setLocation}>
      <RouterProvider link={DemoLink} isCurrent={isCurrent}>
        {children(url)}
      </RouterProvider>
    </NavigateContext>
  );
}
