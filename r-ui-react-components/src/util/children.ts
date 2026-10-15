import { Children, Fragment, type JSXElementConstructor, type ReactElement, type ReactNode, isValidElement } from "react";

/** Each fragment replaced by its contents, recursively; nesting keeps every key unique. */
function unwrapFragments(nodes: ReactNode): ReactNode[] {
  return Children.toArray(nodes).map((child) =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment ? unwrapFragments(child.props.children) : child,
  );
}

/**
 * The element children of `children`, in order: text, numbers, `null`,
 * `false` and other holes are dropped, and fragments are flattened (their
 * contents re-keyed by position, so two fragments never collide). Pass `type`
 * to keep only elements of that component (a compound's parts).
 */
export function elementChildren<P = unknown>(children: ReactNode, type?: JSXElementConstructor<P>): ReactElement<P>[] {
  return Children.toArray(unwrapFragments(children)).filter(
    (child): child is ReactElement<P> => isValidElement(child) && (type === undefined || child.type === type),
  );
}
