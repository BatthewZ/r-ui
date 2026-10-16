import { BookOpen, FileCode, FileText, Folder, Palette, Rocket } from "lucide-react";

import type { TreeNode } from "../../../../src/components/navigation";

/** The demos' trees. In a subfolder, which the section registry does not glob. */

const folder = <Folder aria-hidden />;
const code = <FileCode aria-hidden />;
const text = <FileText aria-hidden />;

export const FILES: TreeNode[] = [
  {
    id: "src",
    label: "src",
    icon: folder,
    children: [
      {
        id: "components",
        label: "components",
        icon: folder,
        children: [
          { id: "button", label: "Button.tsx", icon: code },
          { id: "card", label: "Card.tsx", icon: code },
          { id: "tree", label: "TreeView.tsx", icon: code },
        ],
      },
      { id: "hooks", label: "hooks", icon: folder, children: [{ id: "use-floating", label: "use-floating.ts", icon: code }] },
      { id: "index", label: "index.ts", icon: code },
    ],
  },
  {
    id: "docs",
    label: "docs",
    icon: folder,
    children: [
      { id: "readme", label: "README.md", icon: text },
      {
        id: "long",
        label: "a-really-long-file-name-without-any-spaces-that-has-to-break-somewhere-inside-the-row.md",
        icon: text,
      },
    ],
  },
  { id: "archive", label: "archive (read-only)", icon: folder, disabled: true, children: [{ id: "old", label: "2019.zip", icon: text }] },
  { id: "license", label: "LICENSE", icon: text },
  { id: "package", label: "package.json", icon: code },
];

export const PERMISSIONS: TreeNode[] = [
  {
    id: "billing",
    label: "Billing",
    children: [
      { id: "billing.invoices", label: "View invoices" },
      { id: "billing.refunds", label: "Issue refunds" },
      { id: "billing.payouts", label: "Change payout account (owner only)", disabled: true },
    ],
  },
  {
    id: "people",
    label: "People",
    children: [
      { id: "people.invite", label: "Invite members" },
      {
        id: "people.roles",
        label: "Roles",
        children: [
          { id: "people.roles.assign", label: "Assign roles" },
          { id: "people.roles.edit", label: "Edit role definitions" },
        ],
      },
    ],
  },
  { id: "reports", label: "Reports", children: [{ id: "reports.export", label: "Export data" }] },
];

export const DOCS_NAV: TreeNode[] = [
  {
    id: "start",
    label: "Getting started",
    icon: <Rocket aria-hidden />,
    children: [
      { id: "install", label: "Installation", href: "/docs/install" },
      { id: "first", label: "Your first page", href: "/docs/first-page" },
    ],
  },
  {
    id: "theming",
    label: "Theming",
    icon: <Palette aria-hidden />,
    children: [
      { id: "tokens", label: "Tokens", href: "/docs/theming/tokens" },
      { id: "themes", label: "Writing a theme", href: "/docs/theming/themes" },
      { id: "density", label: "Density", href: "/docs/theming/density" },
    ],
  },
  { id: "reference", label: "Reference", icon: <BookOpen aria-hidden />, href: "/docs/reference" },
];

/** Regions that load their offices on demand; "Antarctica" fails the first time. */
export const REGIONS: TreeNode[] = [
  { id: "europe", label: "Europe", icon: folder, hasChildren: true },
  { id: "asia", label: "Asia", icon: folder, hasChildren: true },
  { id: "antarctica", label: "Antarctica", icon: folder, hasChildren: true },
  { id: "empty", label: "Atlantis (no offices)", icon: folder, hasChildren: true },
];

const OFFICES: Record<string, string[]> = {
  europe: ["Berlin", "Lisbon", "Oslo"],
  asia: ["Osaka", "Singapore"],
  antarctica: ["McMurdo"],
  empty: [],
};

/** A loader that waits, so the loading row is visible, and fails Antarctica's first request. */
export function makeLoader(delay = 900) {
  const attempts = new Map<string, number>();
  return (id: string): Promise<TreeNode[]> => {
    const attempt = (attempts.get(id) ?? 0) + 1;
    attempts.set(id, attempt);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (id === "antarctica" && attempt === 1) reject(new Error("The station did not answer"));
        else resolve((OFFICES[id] ?? []).map((name) => ({ id: `${id}.${name}`, label: name, icon: text })));
      }, delay);
    });
  };
}

/** `count` folders of `count` files: count² + count rows when all are open. */
export function manyNodes(count: number): TreeNode[] {
  return Array.from({ length: count }, (_, f) => ({
    id: `f${f}`,
    label: `Folder ${f + 1}`,
    icon: folder,
    children: Array.from({ length: count }, (_, i) => ({ id: `f${f}.${i}`, label: `Report ${f + 1}.${i + 1}.pdf`, icon: text })),
  }));
}

export const ARABIC: TreeNode[] = [
  {
    id: "ar-docs",
    label: "المستندات",
    icon: folder,
    children: [
      { id: "ar-report", label: "التقرير السنوي.pdf", icon: text },
      { id: "ar-budget", label: "الميزانية.xlsx", icon: text },
    ],
  },
  { id: "ar-photos", label: "الصور", icon: folder, children: [{ id: "ar-trip", label: "رحلة.jpg", icon: text }] },
  { id: "ar-notes", label: "ملاحظات.txt", icon: text },
];
