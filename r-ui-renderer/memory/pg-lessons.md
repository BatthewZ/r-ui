# The playground: hosting a view for people and for browser checks

## "Settled" is a host-side fact

The renderer reports no "every binding has resolved" signal, and it should not need to:
the host performs every request through its own adapter, so the host can count them. Two
details make the count honest. A binding's request starts in an effect after the render
that closed it, and its answer is read and rendered over the following frame, so settled
means complete plus a few consecutive quiet frames, not a zero count at one instant. And
the adapter reads the response body in full before handing a `Response` on, or the count
drops while the bytes are still arriving.

## A check route takes its axes from the URL alone

The playground restores a saved theme, density and input before the first paint; the
full-page route must not, or a choice someone made in the playground leaks into every
check run in the same browser profile. The pre-paint script stands aside on that route,
and any axis the URL leaves out is cleared rather than left as found.

A route error (an unknown document, a bad parameter) still settles, and says so in its own
attribute, so a check fails on what it sees instead of on a timeout.

## Host density is the renderer's option, not the page's attribute

The density a host imposes on a view goes through `ViewRenderer`'s `density`, which marks
the view root. Setting `<html data-density>` instead would also shrink anything the view
portals outside its root, and hide exactly the bug a check of floating panels exists to
find.

## Replay by remounting

Restarting a stream by setting the text back to empty reparses from nothing in place and
shows one empty frame on every restart, and it keeps the previous run's state and forms.
A replay is a new view: key it, so it mounts fresh, and let edits that follow reach the
same mounted view as a complete document.
