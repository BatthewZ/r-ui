import { useToast } from "@batthewz/r-ui-react-components";
import { useMemo } from "react";

import type { HostPolicy, RendererAdapters } from "../src";
import type { RequestTracker } from "./settle";

/** Endpoints under this path read `playground/fixtures/`, which the dev and preview servers and the build serve here, under the app's base path. */
export const FIXTURE_PATH = `${import.meta.env.BASE_URL}fixtures/`;
/** The one place documents may load images from. */
export const FIXTURE_IMAGE_PATH = `${FIXTURE_PATH}img/`;

type Fetch = NonNullable<RendererAdapters["fetch"]>;

function notFound(url: string): Response {
  return new Response(JSON.stringify({ message: `No fixture serves ${url}.` }), {
    status: 404,
    statusText: "Not Found",
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * The `fetch` adapter: a same-origin request under FIXTURE_PATH reads the
 * fixture file at that path (whatever the method; the query string is
 * dropped); anything else answers 404 without a request. The body is read in
 * full before the response is handed on, so a tracker counts the whole load.
 */
export function createFixtureFetch(origin: string, load: Fetch = (url, init) => fetch(url, init)): Fetch {
  return async (url, init) => {
    const target = new URL(url, origin);
    if (target.origin !== origin || !target.pathname.startsWith(FIXTURE_PATH)) return notFound(url);
    const response = await load(new URL(target.pathname, origin).href, { method: "GET", signal: init.signal });
    const body = await response.arrayBuffer();
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
}

export function createFixtureImagePolicy(origin: string): (url: URL) => boolean {
  return (url) => url.origin === origin && url.pathname.startsWith(FIXTURE_IMAGE_PATH);
}

/**
 * The `navigate` adapter: the destination becomes the page's hash, so a view
 * never leaves the playground. The renderer hands it an absolute URL; a
 * same-origin one is kept as its path (or its fragment alone, on this page).
 */
export function navigateToHash(to: string, { replace }: { readonly replace: boolean }): void {
  const url = new URL(to, location.href);
  const here = url.origin === location.origin && url.pathname === location.pathname && url.search === location.search;
  const destination = url.origin !== location.origin ? url.href : here ? url.hash : `${url.pathname}${url.search}${url.hash}`;
  const hash = destination.startsWith("#") ? destination : `#${destination}`;
  if (replace) history.replaceState(history.state, "", hash);
  else location.hash = hash;
}

/** What every view may reach: images and Markdown images from FIXTURE_IMAGE_PATH only; requests stay same-origin. */
export const PLAYGROUND_POLICY: HostPolicy = Object.freeze({
  allowImageUrl: createFixtureImagePolicy(location.origin),
  markdownImages: Object.freeze([FIXTURE_IMAGE_PATH]),
});

/** Every adapter the playground hosts a view with; `tracker` counts its fixture requests. */
export function usePlaygroundAdapters(tracker: RequestTracker): RendererAdapters {
  const { toast } = useToast();
  return useMemo(() => {
    const fetchFixture = createFixtureFetch(location.origin);
    return {
      toast,
      navigate: navigateToHash,
      fetch: (url, init) => tracker.track(fetchFixture(url, init)),
    };
  }, [toast, tracker]);
}
