import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentPropsWithRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { RouterProvider } from "../../util/router";
import { type TreeNode, TreeView } from "./TreeView";

const FILES: TreeNode[] = [
  {
    id: "src",
    label: "src",
    children: [
      {
        id: "components",
        label: "components",
        children: [
          { id: "button", label: "Button.tsx" },
          { id: "card", label: "Card.tsx" },
        ],
      },
      { id: "index", label: "index.ts" },
    ],
  },
  { id: "docs", label: "docs", children: [{ id: "readme", label: "README.md" }] },
  { id: "decisions", label: "decisions.md" },
  { id: "package", label: "package.json" },
];

const item = (name: string) => screen.getByRole("treeitem", { name });
const names = () => screen.queryAllByRole("treeitem").map((el) => el.textContent);
const focusedName = () => document.activeElement?.textContent;

async function focusTree(user: ReturnType<typeof userEvent.setup>) {
  await user.tab();
  expect(document.activeElement).toBe(item("src"));
}

describe("TreeView structure", () => {
  it("is one flat tree whose rows carry level, set size and position; closed branches are absent", () => {
    render(<TreeView aria-label="Files" items={FILES} defaultExpandedIds={["src"]} />);
    expect(screen.getByRole("tree", { name: "Files" })).toBeInTheDocument();
    expect(names()).toEqual(["src", "components", "index.ts", "docs", "decisions.md", "package.json"]);
    const components = item("components");
    expect(components).toHaveAttribute("aria-level", "2");
    expect(components).toHaveAttribute("aria-setsize", "2");
    expect(components).toHaveAttribute("aria-posinset", "1");
    expect(components).toHaveAttribute("aria-expanded", "false");
    expect(item("src")).toHaveAttribute("aria-expanded", "true");
    expect(item("package.json")).not.toHaveAttribute("aria-expanded");
    expect(item("package.json")).toHaveAttribute("aria-posinset", "4");
  });

  it("has exactly one tab stop", () => {
    render(<TreeView aria-label="Files" items={FILES} defaultExpandedIds={["src"]} />);
    expect(screen.getAllByRole("treeitem").filter((el) => el.tabIndex === 0)).toEqual([item("src")]);
  });

  it("reads the same tree from TreeView.Item composition", () => {
    render(
      <TreeView aria-label="Composed" defaultExpandedIds={["a"]}>
        <TreeView.Item id="a" label="Alpha">
          <TreeView.Item id="a1" label="Alpha one" />
          <>
            <TreeView.Item id="a2" label="Alpha two" />
          </>
        </TreeView.Item>
        <TreeView.Item id="b" label="Beta" />
      </TreeView>,
    );
    expect(names()).toEqual(["Alpha", "Alpha one", "Alpha two", "Beta"]);
    expect(item("Alpha two")).toHaveAttribute("aria-posinset", "2");
    expect(item("Alpha two")).toHaveAttribute("aria-level", "2");
  });

  it("names each row by its label only, not by its actions", () => {
    render(
      <TreeView
        aria-label="Files"
        items={FILES}
        renderActions={(node, { tabIndex }) => (
          <button type="button" tabIndex={tabIndex}>
            Delete {String(node.label)}
          </button>
        )}
      />,
    );
    expect(item("docs")).toBeInTheDocument();
    // The tree owns only its rows: every role outside a row is a treeitem (a status region lives outside the tree).
    const tree = screen.getByRole("tree");
    const owned = [...tree.querySelectorAll("[role]")].filter((el) => !el.parentElement?.closest('[role="treeitem"]'));
    expect(owned.map((el) => el.getAttribute("role"))).toEqual(screen.getAllByRole("treeitem").map(() => "treeitem"));
  });
});

describe("TreeView keyboard (APG)", () => {
  it("walks visible rows with Up/Down and jumps with Home/End, without wrapping", async () => {
    const user = userEvent.setup();
    render(<TreeView aria-label="Files" items={FILES} defaultExpandedIds={["src"]} />);
    await focusTree(user);
    await user.keyboard("{ArrowUp}");
    expect(focusedName()).toBe("src");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(focusedName()).toBe("index.ts");
    await user.keyboard("{End}");
    expect(focusedName()).toBe("package.json");
    await user.keyboard("{ArrowDown}");
    expect(focusedName()).toBe("package.json");
    await user.keyboard("{Home}");
    expect(focusedName()).toBe("src");
    expect(document.activeElement).toHaveAttribute("tabindex", "0");
  });

  it("Right opens a closed parent, then enters it; Left closes it, then goes to the parent", async () => {
    const user = userEvent.setup();
    render(<TreeView aria-label="Files" items={FILES} />);
    await focusTree(user);
    await user.keyboard("{ArrowRight}");
    expect(item("src")).toHaveAttribute("aria-expanded", "true");
    expect(focusedName()).toBe("src");
    await user.keyboard("{ArrowRight}");
    expect(focusedName()).toBe("components");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(focusedName()).toBe("Button.tsx");
    await user.keyboard("{ArrowRight}");
    expect(focusedName()).toBe("Button.tsx");
    await user.keyboard("{ArrowLeft}");
    expect(focusedName()).toBe("components");
    await user.keyboard("{ArrowLeft}");
    expect(item("components")).toHaveAttribute("aria-expanded", "false");
    expect(focusedName()).toBe("components");
    await user.keyboard("{ArrowLeft}");
    expect(focusedName()).toBe("src");
  });

  it("mirrors Left and Right in a right-to-left context", async () => {
    const user = userEvent.setup();
    render(
      <div style={{ direction: "rtl" }}>
        <TreeView aria-label="Files" items={FILES} />
      </div>,
    );
    await focusTree(user);
    await user.keyboard("{ArrowLeft}");
    expect(item("src")).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowLeft}");
    expect(focusedName()).toBe("components");
    await user.keyboard("{ArrowRight}");
    expect(focusedName()).toBe("src");
  });

  it("* opens every sibling at the focused row's level, and nothing deeper", async () => {
    const user = userEvent.setup();
    render(<TreeView aria-label="Files" items={FILES} />);
    await focusTree(user);
    await user.keyboard("*");
    expect(item("src")).toHaveAttribute("aria-expanded", "true");
    expect(item("docs")).toHaveAttribute("aria-expanded", "true");
    expect(item("components")).toHaveAttribute("aria-expanded", "false");
    expect(focusedName()).toBe("src");
  });

  it("* leaves a visible deeper branch closed", async () => {
    const user = userEvent.setup();
    render(<TreeView aria-label="Files" items={FILES} defaultExpandedIds={["src"]} />);
    await focusTree(user);
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(focusedName()).toBe("docs");
    await user.keyboard("*");
    expect(item("docs")).toHaveAttribute("aria-expanded", "true");
    expect(item("src")).toHaveAttribute("aria-expanded", "true");
    expect(item("components")).toHaveAttribute("aria-expanded", "false");
    expect(focusedName()).toBe("docs");
  });

  it("typeahead jumps to the next label that starts with the typed text; a repeated letter cycles", async () => {
    const user = userEvent.setup();
    render(<TreeView aria-label="Files" items={FILES} />);
    await focusTree(user);
    await user.keyboard("d");
    expect(focusedName()).toBe("docs");
    await user.keyboard("d");
    expect(focusedName()).toBe("decisions.md");
    await user.keyboard("d");
    expect(focusedName()).toBe("docs");
    await act(() => new Promise((r) => setTimeout(r, 600)));
    await user.keyboard("pa");
    expect(focusedName()).toBe("package.json");
  });

  it("keeps focus on a node when a press on its ancestor's chevron collapses the branch around it", async () => {
    const user = userEvent.setup();
    render(<TreeView aria-label="Files" items={FILES} defaultExpandedIds={["src", "components"]} />);
    await focusTree(user);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(focusedName()).toBe("Button.tsx");
    const chevron = item("src").querySelector<HTMLElement>("[data-tree-toggle]");
    expect(chevron).not.toBeNull();
    await user.click(chevron!);
    expect(item("src")).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(item("src"));
    expect(item("src")).toHaveAttribute("tabindex", "0");
  });

  // The owner closes a branch the focused row sits in (a shortcut it handles):
  // the row unmounts, and focus would fall to <body>.
  it("hands focus to the nearest visible ancestor when the owner closes the branch under focus", async () => {
    const user = userEvent.setup();
    function Owned() {
      const [expanded, setExpanded] = useState<readonly string[]>(["docs"]);
      return (
        <TreeView
          aria-label="Files"
          items={FILES}
          expandedIds={expanded}
          onExpandedIdsChange={setExpanded}
          onKeyDown={(event) => {
            if (event.key === "Escape") setExpanded([]);
          }}
        />
      );
    }
    render(<Owned />);
    await focusTree(user);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(focusedName()).toBe("README.md");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("treeitem", { name: "README.md" })).toBeNull();
    expect(document.activeElement).toBe(item("docs"));
    expect(screen.getAllByRole("treeitem").filter((el) => el.tabIndex === 0)).toEqual([item("docs")]);
  });
});

describe("TreeView selection", () => {
  it("single: a press, Enter or Space selects one row and reports it once per change", async () => {
    const user = userEvent.setup();
    const onSelectedIdChange = vi.fn();
    render(<TreeView aria-label="Files" items={FILES} selectionMode="single" onSelectedIdChange={onSelectedIdChange} />);
    await user.click(item("docs"));
    expect(item("docs")).toHaveAttribute("aria-selected", "true");
    expect(item("src")).toHaveAttribute("aria-selected", "false");
    expect(onSelectedIdChange).toHaveBeenCalledTimes(1);
    await user.keyboard("{ArrowDown} ");
    expect(item("decisions.md")).toHaveAttribute("aria-selected", "true");
    expect(item("docs")).toHaveAttribute("aria-selected", "false");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(item("package.json")).toHaveAttribute("aria-selected", "true");
    expect(onSelectedIdChange.mock.calls.map(([id]) => id)).toEqual(["docs", "decisions", "package"]);
  });

  it("a disabled node takes focus but is never selected or activated", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const items: TreeNode[] = [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta", disabled: true }];
    render(<TreeView aria-label="Disabled" items={items} selectionMode="single" onAction={onAction} />);
    await user.click(item("Beta"));
    expect(document.activeElement).toBe(item("Beta"));
    expect(item("Beta")).toHaveAttribute("aria-disabled", "true");
    expect(item("Beta")).toHaveAttribute("aria-selected", "false");
    expect(onAction).not.toHaveBeenCalled();
  });

  it("multiple: checks cascade down, parents show mixed, and a disabled child keeps its state", async () => {
    const user = userEvent.setup();
    const onCheckedIdsChange = vi.fn();
    const perms: TreeNode[] = [
      {
        id: "billing",
        label: "Billing",
        children: [
          { id: "invoices", label: "Invoices" },
          { id: "refunds", label: "Refunds" },
          { id: "payouts", label: "Payouts", disabled: true },
        ],
      },
    ];
    render(
      <TreeView
        aria-label="Permissions"
        items={perms}
        selectionMode="multiple"
        defaultExpandedIds={["billing"]}
        onCheckedIdsChange={onCheckedIdsChange}
      />,
    );
    expect(screen.getByRole("tree")).toHaveAttribute("aria-multiselectable", "true");
    expect(item("Billing")).toHaveAttribute("aria-checked", "false");
    await user.click(item("Invoices"));
    expect(item("Billing")).toHaveAttribute("aria-checked", "mixed");
    await user.keyboard("{ArrowDown} ");
    expect(item("Refunds")).toHaveAttribute("aria-checked", "true");
    // Payouts is disabled and unchecked, so Billing stays mixed.
    expect(item("Billing")).toHaveAttribute("aria-checked", "mixed");
    await user.click(item("Billing"));
    expect(item("Invoices")).toHaveAttribute("aria-checked", "false");
    expect(item("Refunds")).toHaveAttribute("aria-checked", "false");
    expect(item("Payouts")).toHaveAttribute("aria-checked", "false");
    await user.click(item("Billing"));
    expect(onCheckedIdsChange.mock.calls.map(([ids]) => ids)).toEqual([["invoices"], ["invoices", "refunds"], [], ["invoices", "refunds"]]);
  });
});

describe("TreeView lazy children", () => {
  function deferred() {
    let resolve!: (nodes: readonly TreeNode[]) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<readonly TreeNode[]>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  it("shows a loading row while children load, then the children; announces both", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    const loadChildren = vi.fn(() => pending.promise);
    render(<TreeView aria-label="Remote" items={[{ id: "r", label: "Remote", hasChildren: true }]} loadChildren={loadChildren} />);
    expect(item("Remote")).toHaveAttribute("aria-expanded", "false");
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(loadChildren).toHaveBeenCalledTimes(1);
    expect(loadChildren).toHaveBeenCalledWith("r");
    expect(item("Remote")).toHaveAttribute("aria-busy", "true");
    const loading = document.querySelector<HTMLElement>("[data-tree-loading]");
    expect(loading).toHaveTextContent("Loading…");
    // A stand-in, never a row: no role, no tab stop, one level in, and the arrows pass it by.
    expect(loading).not.toHaveAttribute("role");
    expect(loading).not.toHaveAttribute("tabindex");
    expect(loading?.style.getPropertyValue("--r-navigation-tree-depth")).toBe("1");
    expect(screen.getAllByRole("treeitem")).toEqual([item("Remote")]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(item("Remote"));
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    await act(async () => pending.resolve([{ id: "r1", label: "First" }, { id: "r2", label: "Second" }]));
    expect(names()).toEqual(["Remote", "First", "Second"]);
    expect(document.querySelector("[data-tree-loading]")).toBeNull();
    expect(item("Remote")).not.toHaveAttribute("aria-busy");
    expect(screen.getByRole("status")).toHaveTextContent("2 items loaded");
    // Closing and reopening uses what was loaded.
    await user.keyboard("{ArrowLeft}{ArrowRight}");
    expect(loadChildren).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(item("Remote"));
  });

  it("a branch that loads no children becomes a leaf", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    render(<TreeView aria-label="Remote" items={[{ id: "r", label: "Remote", hasChildren: true }]} loadChildren={() => pending.promise} />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(item("Remote")).toHaveAttribute("aria-expanded", "true");
    await act(async () => pending.resolve([]));
    expect(item("Remote")).not.toHaveAttribute("aria-expanded");
    expect(document.querySelector("[data-tree-loading]")).toBeNull();
    expect(names()).toEqual(["Remote"]);
    expect(document.activeElement).toBe(item("Remote"));
  });

  it("a failed load leaves an error row; Enter on it retries and focus returns to the parent", async () => {
    const user = userEvent.setup();
    const first = deferred();
    const second = deferred();
    const loadChildren = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(
      <TreeView
        aria-label="Remote"
        items={[{ id: "r", label: "Remote", hasChildren: true }]}
        defaultExpandedIds={["r"]}
        loadChildren={loadChildren}
      />,
    );
    await act(async () => first.reject(new Error("offline")));
    const errorRow = item("Couldn’t load these items. Retry");
    expect(errorRow).toHaveAttribute("aria-level", "2");
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(errorRow);
    await user.keyboard("{Enter}");
    expect(loadChildren).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(item("Remote"));
    await act(async () => second.resolve([{ id: "r1", label: "Back online" }]));
    expect(names()).toEqual(["Remote", "Back online"]);
  });
});

describe("TreeView links", () => {
  function RecordingLink({ href, onClick, ...props }: ComponentPropsWithRef<"a">) {
    return (
      <a
        href={href}
        data-router-link=""
        onClick={(event) => {
          event.preventDefault();
          onClick?.(event);
          navigations.push(href ?? "");
        }}
        {...props}
      />
    );
  }
  let navigations: string[] = [];

  const DOCS: TreeNode[] = [
    {
      id: "guides",
      label: "Guides",
      children: [
        { id: "install", label: "Install", href: "/guides/install" },
        { id: "theming", label: "Theming", href: "/guides/theming" },
      ],
    },
    { id: "api", label: "API", href: "/api" },
  ];

  it("renders the router's link, marks the current page, opens down to it and makes it the tab stop", () => {
    navigations = [];
    render(
      <RouterProvider link={RecordingLink} isCurrent={(href) => href === "/guides/theming"}>
        <TreeView aria-label="Docs" items={DOCS} />
      </RouterProvider>,
    );
    expect(item("Guides")).toHaveAttribute("aria-expanded", "true");
    expect(item("Theming")).toHaveAttribute("aria-current", "page");
    expect(item("Theming")).toHaveAttribute("tabindex", "0");
    expect(item("Install")).not.toHaveAttribute("aria-current");
    expect(within(item("Install")).getByText("Install").closest("a")).toHaveAttribute("data-router-link");
  });

  it("in single selection, Space selects a link row without following it", async () => {
    navigations = [];
    const user = userEvent.setup();
    render(
      <RouterProvider link={RecordingLink}>
        <TreeView aria-label="Docs" items={DOCS} selectionMode="single" />
      </RouterProvider>,
    );
    await user.tab();
    await user.keyboard("{End} ");
    expect(item("API")).toHaveAttribute("aria-selected", "true");
    expect(navigations).toEqual([]);
    await user.keyboard("{Enter}");
    expect(navigations).toEqual(["/api"]);
  });

  it("Enter follows the link once, through the router", async () => {
    navigations = [];
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <RouterProvider link={RecordingLink}>
        <TreeView aria-label="Docs" items={DOCS} onAction={onAction} />
      </RouterProvider>,
    );
    await user.tab();
    await user.keyboard("{End}{Enter}");
    expect(navigations).toEqual(["/api"]);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith("api", expect.objectContaining({ href: "/api" }));
  });

  it("drops an href safeUrl refuses: the node is plain, never current, and Enter acts on it instead of following", async () => {
    navigations = [];
    const user = userEvent.setup();
    const onAction = vi.fn();
    const items: TreeNode[] = [
      { id: "hostile", label: "Hostile", href: "javascript:alert(1)", children: [{ id: "child", label: "Child" }] },
      { id: "api", label: "API", href: "/api" },
    ];
    render(
      <RouterProvider link={RecordingLink} isCurrent={(href) => href !== "/api"}>
        <TreeView aria-label="Docs" items={items} onAction={onAction} />
      </RouterProvider>,
    );
    expect(within(item("API")).getByRole("link")).toHaveAttribute("href", "/api");
    expect(within(item("Hostile")).queryByRole("link")).toBeNull();
    expect(item("Hostile")).not.toHaveAttribute("aria-current");
    expect(item("Hostile")).toHaveAttribute("aria-expanded", "false");
    await user.tab();
    expect(document.activeElement).toBe(item("Hostile"));
    await user.keyboard("{Enter}");
    expect(item("Hostile")).toHaveAttribute("aria-expanded", "true");
    expect(onAction).toHaveBeenCalledExactlyOnceWith("hostile", expect.objectContaining({ id: "hostile" }));
    expect(navigations).toEqual([]);
  });
});

describe("TreeView actions", () => {
  it("only the focused row's actions are tabbable, and pressing one neither selects nor moves the tree", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <TreeView
        aria-label="Files"
        items={FILES}
        selectionMode="single"
        renderActions={(node, { tabIndex }) => (
          <button type="button" tabIndex={tabIndex} onClick={() => onDelete(node.id)}>
            Delete
          </button>
        )}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: "Delete" });
    expect(buttons.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    expect(within(item("src")).getByRole("button")).toHaveAttribute("tabindex", "0");
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(within(item("src")).getByRole("button"));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(within(item("src")).getByRole("button"));
    await user.click(within(item("docs")).getByRole("button"));
    expect(onDelete).toHaveBeenCalledExactlyOnceWith("docs");
    expect(item("docs")).toHaveAttribute("aria-selected", "false");
  });
});

describe("TreeView Tab order", () => {
  it("Tab enters on the tab-stop row, then reaches that row's own actions, then leaves the tree", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <TreeView
          aria-label="Files"
          items={FILES}
          defaultExpandedIds={["src"]}
          renderActions={(node, { tabIndex }) => (
            <>
              <button type="button" tabIndex={tabIndex}>
                Rename {String(node.label)}
              </button>
              <button type="button" tabIndex={tabIndex}>
                Delete {String(node.label)}
              </button>
            </>
          )}
        />
        <button type="button">After</button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Before" }));
    await user.tab();
    expect(document.activeElement).toBe(item("src"));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Rename src" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Delete src" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });
});

describe("TreeView windowing", () => {
  const MANY: TreeNode[] = Array.from({ length: 60 }, (_, i) => ({ id: `n${i}`, label: `Node ${i + 1}` }));

  it("past the threshold mounts a window, keeps set positions, and End reaches the last row", async () => {
    const user = userEvent.setup();
    render(<TreeView aria-label="Many" items={MANY} virtualizeAbove={20} />);
    const mounted = screen.getAllByRole("treeitem").length;
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(60);
    await user.tab();
    await user.keyboard("{End}");
    expect(focusedName()).toBe("Node 60");
    expect(document.activeElement).toHaveAttribute("aria-posinset", "60");
    expect(document.activeElement).toHaveAttribute("aria-setsize", "60");
  });

  it("below the threshold mounts every row", () => {
    render(<TreeView aria-label="Many" items={MANY} />);
    expect(screen.getAllByRole("treeitem")).toHaveLength(60);
  });
});

describe("TreeView states and labels", () => {
  it("empty, loading and error states", () => {
    const { rerender } = render(<TreeView aria-label="Files" items={[]} />);
    expect(screen.getByRole("group", { name: "Files" })).toHaveTextContent("Nothing here yet.");
    expect(screen.queryByRole("tree")).toBeNull();
    rerender(<TreeView aria-label="Files" items={FILES} loading />);
    expect(screen.getByRole("tree")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryAllByRole("treeitem")).toHaveLength(0);
    rerender(<TreeView aria-label="Files" items={FILES} error="The file list is unavailable." />);
    expect(screen.getByRole("group", { name: "Files" })).toHaveTextContent("The file list is unavailable.");
  });

  it("takes words from the LocaleProvider, and the instance's labels over them", () => {
    function Both() {
      const [own] = useState({ empty: "Leer (Instanz)" });
      return (
        <LocaleProvider labels={{ TreeView: { empty: "Leer", retry: "Erneut" } }}>
          <TreeView aria-label="A" items={[]} />
          <TreeView aria-label="B" items={[]} labels={own} />
        </LocaleProvider>
      );
    }
    render(<Both />);
    expect(screen.getByRole("group", { name: "A" })).toHaveTextContent("Leer");
    expect(screen.getByRole("group", { name: "B" })).toHaveTextContent("Leer (Instanz)");
  });

  it("controlled expandedIds: the tree asks, the owner decides", async () => {
    const user = userEvent.setup();
    const onExpandedIdsChange = vi.fn();
    render(<TreeView aria-label="Files" items={FILES} expandedIds={[]} onExpandedIdsChange={onExpandedIdsChange} />);
    await focusTree(user);
    await user.keyboard("{ArrowRight}");
    expect(onExpandedIdsChange).toHaveBeenCalledExactlyOnceWith(["src"]);
    expect(item("src")).toHaveAttribute("aria-expanded", "false");
  });
});
