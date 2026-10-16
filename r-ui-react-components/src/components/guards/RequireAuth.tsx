"use client";
import { LockKeyhole, ShieldX } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

import { type LabelsProp, useLabels } from "../../util/locale";
import { cn } from "../../util/style";
import { Link, Spinner } from "../primitives";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface RequireAuthLabels {
  /** The default loading fallback's status text. */
  loading: string;
  /** The default signed-out fallback: its title, explanation and link text. */
  signInTitle: string;
  signInBody: string;
  signIn: string;
  /** The default fallback when `authorize` refuses. */
  forbiddenTitle: string;
  forbiddenBody: string;
}

export const DEFAULT_REQUIRE_AUTH_LABELS: RequireAuthLabels = {
  loading: "Checking your session…",
  signInTitle: "Sign in to continue",
  signInBody: "You need to be signed in to see this.",
  signIn: "Sign in",
  forbiddenTitle: "You don’t have access",
  forbiddenBody: "Your account can’t open this. Ask an administrator for access.",
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    RequireAuth: RequireAuthLabels;
  }
}

export interface RequireAuthProps {
  /** Where your auth library stands. Only `"authenticated"` ever renders `children`. */
  status: AuthStatus;
  /**
   * Roles or permissions, once signed in: `false` renders the forbidden
   * fallback instead of `children`. Called only while authenticated.
   */
  authorize?: () => boolean;
  /** The protected content. */
  children?: ReactNode;
  /** Replaces the default wait (a spinner and `labels.loading`, a status). */
  loadingFallback?: ReactNode;
  /** Replaces the default signed-out message (with a sign-in link when `signInHref` is set). */
  unauthenticatedFallback?: ReactNode;
  /** Replaces the default "no access" message. */
  forbiddenFallback?: ReactNode;
  /**
   * Called once each time `status` becomes `"unauthenticated"`: navigate to
   * your sign-in route with your router here. The fallback still renders
   * meanwhile, so the page is never blank.
   */
  onUnauthenticated?: () => void;
  /** The default signed-out fallback links here, through the `RouterProvider`'s link. */
  signInHref?: string;
  labels?: LabelsProp<RequireAuthLabels>;
  /** Styles the default fallbacks' box. `children` render as they are, unwrapped. */
  className?: string;
}

const BOX = "grid min-w-0 justify-items-center gap-r4 px-r2 py-r1 text-center";

/**
 * A gate that knows no router and no auth library: the caller passes `status`
 * (and, for roles or permissions, `authorize`). While loading it renders a
 * wait, never the protected content; signed out, a message, a sign-in link and
 * `onUnauthenticated` for a redirect; refused, a "no access" message.
 */
export function RequireAuth({
  status,
  authorize,
  children,
  loadingFallback,
  unauthenticatedFallback,
  forbiddenFallback,
  onUnauthenticated,
  signInHref,
  labels: labelsProp,
  className,
}: RequireAuthProps) {
  const labels = useLabels("RequireAuth", DEFAULT_REQUIRE_AUTH_LABELS, labelsProp);
  const onUnauthenticatedRef = useRef(onUnauthenticated);
  onUnauthenticatedRef.current = onUnauthenticated;

  // Keyed to the status alone: one call per arrival at "unauthenticated", not one per render.
  useEffect(() => {
    if (status === "unauthenticated") onUnauthenticatedRef.current?.();
  }, [status]);

  if (status === "authenticated") {
    if (!authorize || authorize()) return <>{children}</>;
    return (
      forbiddenFallback ?? (
        <div className={cn(BOX, className)} data-auth-state="forbidden">
          <ShieldX aria-hidden className="size-icon text-fg-muted" />
          <p className="text-h5">{labels.forbiddenTitle}</p>
          <p className="max-w-measure text-body-1 text-fg-secondary">{labels.forbiddenBody}</p>
        </div>
      )
    );
  }

  if (status === "unauthenticated") {
    return (
      unauthenticatedFallback ?? (
        <div className={cn(BOX, className)} data-auth-state="unauthenticated">
          <LockKeyhole aria-hidden className="size-icon text-fg-muted" />
          <p className="text-h5">{labels.signInTitle}</p>
          <p className="max-w-measure text-body-1 text-fg-secondary">{labels.signInBody}</p>
          {signInHref !== undefined && (
            <Link href={signInHref} className="hit-area text-body-1">
              {labels.signIn}
            </Link>
          )}
        </div>
      )
    );
  }

  // Loading, or any status this version does not know: never the protected content.
  return (
    loadingFallback ?? (
      <div className={cn(BOX, className)} data-auth-state="loading">
        <p role="status" className="flex items-center gap-r4 text-body-1 text-fg-secondary">
          <Spinner />
          {labels.loading}
        </p>
      </div>
    )
  );
}
