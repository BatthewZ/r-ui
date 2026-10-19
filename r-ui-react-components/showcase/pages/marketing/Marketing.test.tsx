import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Marketing } from "../Marketing";
import { DETAILS, ROWS, STATS } from "./content";

afterEach(() => {
  vi.restoreAllMocks();
});

/** The section anchors `#/marketing/<id>` links on the page point at. */
const inPageTargets = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLAnchorElement>('a[href^="#/marketing/"]')].map((a) =>
    decodeURIComponent(a.getAttribute("href")!.split("/")[2]!),
  );

describe("the Marketing page", () => {
  it("renders without a React warning, with one h1 (the hero's)", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(<Marketing anchor={null} />);
    expect(error).not.toHaveBeenCalled();
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0]!.closest('[data-mkt="hero"]')).not.toBeNull();
  });

  it("every in-page link lands on an element of the page", () => {
    const { container } = render(<Marketing anchor={null} />);
    // The Product panel renders its links once open.
    fireEvent.click(within(screen.getByRole("navigation", { name: "Kiln" })).getByRole("button", { name: "Product" }));
    const targets = new Set(inPageTargets(container));
    expect(targets).toEqual(new Set(["features", "how-it-works", "compare", "customers", "journal", "pricing", "faq"]));
    for (const id of targets) expect(container.querySelector(`#${CSS.escape(id)}`), id).not.toBeNull();
  });

  it("keeps the hooks the browser checks select", () => {
    const { container } = render(<Marketing anchor={null} />);
    for (const hook of ["hero", "prose", "prose-ui", "prose-select", "prose-button", "quotes", "posts", "region"]) {
      expect(container.querySelector(`[data-mkt="${hook}"]`), hook).not.toBeNull();
    }
    expect(container.querySelectorAll('[data-mkt="posts"] article')).toHaveLength(4);
    // The essay's last link is the last stop before the first post (the MediaCard check tabs from it).
    const essayLinks = container.querySelectorAll('[data-mkt="prose"] a');
    expect(essayLinks[essayLinks.length - 1]).toHaveAttribute("href", "#/marketing/faq");
  });

  it("puts each motion extra where its contract allows: decoration only, the content beside it", () => {
    const { container } = render(<Marketing anchor={null} />);
    // Every figure counts up, and reads as its final value.
    const figures = screen.getByRole("list", { name: "Kiln in numbers" });
    expect(figures.querySelectorAll(".r-motion-count-up")).toHaveLength(STATS.length);
    // Each feature row's illustration drifts; the layer holds a decorative picture and no text.
    const layers = [...container.querySelectorAll<HTMLElement>("#features .r-motion-parallax")];
    expect(layers).toHaveLength(ROWS.length);
    for (const layer of layers) {
      expect(layer.querySelector('img[alt=""]')).not.toBeNull();
      expect(layer.textContent).toBe("");
    }
    // The essay is the region its reading bar measures.
    const essay = container.querySelector('[data-mkt="prose"]')!.closest(".r-motion-reading");
    expect(essay?.tagName).toBe("ARTICLE");
    // Every detail card takes the spotlight, and stays a list item of the grid.
    const cards = container.querySelectorAll('[aria-labelledby="mkt-details-title"] li.r-motion-spotlight');
    expect(cards).toHaveLength(DETAILS.length);
  });

  it("the footer's region switcher re-formats the page's figures, prices and dates", () => {
    render(<Marketing anchor={null} />);
    const figures = screen.getByRole("list", { name: "Kiln in numbers" });
    const plans = screen.getByRole("list", { name: "Plans" });
    const posts = document.querySelector<HTMLElement>('[data-mkt="posts"]')!;
    // CountUp writes its value three times (sizer, frame, spoken copy); the spoken one is the figure.
    const figure = (text: string) => within(figures).queryAllByText(text).filter((el) => el.classList.contains("sr-only"));
    expect(figure("1,400")).toHaveLength(1);
    expect(within(plans).getByText("$12")).toBeInTheDocument();
    expect(within(posts).getByText("September 30")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Region" }), { target: { value: "de-DE" } });

    expect(figure("1.400")).toHaveLength(1);
    expect(within(figures).queryByText("1,400")).toBeNull();
    expect(within(plans).getByText(/^12\s\$$/)).toBeInTheDocument();
    expect(within(posts).getByText("30. September")).toBeInTheDocument();
  });
});
