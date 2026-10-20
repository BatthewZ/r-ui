/**
 * Library components a document cannot use, each with its reason. A root
 * excludes its compound parts with it; a part can be excluded alone. Every
 * other component the library's barrel exports is addressable.
 */

export const EXCLUSION_REASONS = {
  HOST: "The host's chrome, provider or policy; a document lives inside it.",
  CODE: "Needs host code that no declarative substitute can express.",
  IDENTITY: "Reads its children by element type in a way a document cannot address.",
  FIT: "A model-authored view should not reach for it.",
  INTERNAL: "The renderer already does this itself.",
} as const;

export type ExclusionReason = keyof typeof EXCLUSION_REASONS;

export interface Exclusion {
  readonly reason: ExclusionReason;
  /** One line: why, and what to use instead. */
  readonly why: string;
}

export const NOT_ADDRESSABLE: { readonly [name: string]: Exclusion } = {
  AppShell: { reason: "HOST", why: "The app frame is the host's; a view renders inside its main region." },
  ToastProvider: { reason: "HOST", why: "The host mounts the one toast stack; documents raise toasts with `showToast`." },
  RouterProvider: { reason: "HOST", why: "The host's router already drives every library link a document renders." },
  LocaleProvider: { reason: "HOST", why: "Locale and translations are the host's." },
  DocumentTitleProvider: { reason: "HOST", why: "The page title is host chrome." },
  CommandPalette: { reason: "HOST", why: "An app-wide launcher bound to a global shortcut; use a DropdownMenu for a view's actions." },
  SiteHeader: { reason: "HOST", why: "The site's top bar is the host's." },
  NavigationMenu: { reason: "HOST", why: "Site navigation is the host's; use NavList or Tabs inside a view." },
  Footer: { reason: "HOST", why: "The site footer is the host's." },
  ThemeSwitcher: { reason: "HOST", why: "Theme is the host's choice, never a document's." },
  DensitySwitcher: { reason: "HOST", why: "Page density is the host's; a document sets `density` or `data-density` on its own subtree." },
  InputSwitcher: { reason: "HOST", why: "The input mode is the host's." },
  PreferencesMenu: { reason: "HOST", why: "Theme, density and input preferences are the host's." },
  ThemeScript: { reason: "HOST", why: "An inline script for the host's document head." },
  RequireAuth: { reason: "HOST", why: "Auth is the host's; a gate whose status a document supplies protects nothing." },
  FileUpload: { reason: "CODE", why: "Its value is File objects or a host upload handler." },
  AvatarUpload: { reason: "CODE", why: "Needs a host upload handler; show a picture with Avatar." },
  Kanban: { reason: "FIT", why: "Moving work items is an editing surface over host records; use DataTable or a list of Cards." },
  ContextMenu: { reason: "FIT", why: "A shortcut that is never the only door; use DropdownMenu." },
  Splitter: { reason: "FIT", why: "Resizable panes are host layout; lay a view out with Grid or Stack." },
  Parallax: { reason: "FIT", why: "Decoration that only works when its caller positions it; a Hero owns its own backdrop." },
  ReadingProgress: { reason: "FIT", why: "Page-level reading chrome that needs the host's scroll container." },
  Spotlight: { reason: "FIT", why: "A pointer-following wash with no information; it is meant to wrap a component type." },
  ErrorBoundary: { reason: "INTERNAL", why: "The renderer contains every node's errors itself; use ErrorFallback to show a failure." },
  "TreeView.Item": { reason: "IDENTITY", why: "TreeView reads its items by element type; give TreeView its `items` data instead." },
};
