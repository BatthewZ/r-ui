import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Image } from "./Image";

const PHOTO = { src: "/photos/dunes.jpg", alt: "Dunes at first light", width: 1600, height: 1000 };
const TINY = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E";

const root = (container: HTMLElement) => container.firstElementChild as HTMLElement;
const picture = (container: HTMLElement) => container.querySelector<HTMLImageElement>("img.r-media-image-picture");

describe("Image", () => {
  it("reserves its box from the intrinsic size before anything loads, lazily and decoded off the main thread", () => {
    const { container } = render(<Image {...PHOTO} />);
    const box = root(container);
    expect(box.style.getPropertyValue("--r-media-image-w")).toBe("1600");
    expect(box.style.getPropertyValue("--r-media-image-h")).toBe("1000");
    expect(box).toHaveAttribute("data-state", "loading");
    expect(box).toHaveAttribute("aria-busy", "true");

    const img = screen.getByRole("img", { name: "Dunes at first light" });
    expect(img).toBe(picture(container));
    expect(img).toHaveAttribute("width", "1600");
    expect(img).toHaveAttribute("height", "1000");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
    expect(img).not.toHaveAttribute("fetchpriority");
  });

  it("priority loads at once with high fetch priority; srcSet and sizes pass through", () => {
    const { container } = render(<Image {...PHOTO} priority srcSet="/a.jpg 800w, /b.jpg 1600w" sizes="(min-width: 60rem) 50rem, 100%" />);
    const img = picture(container)!;
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).toHaveAttribute("fetchpriority", "high");
    expect(img).toHaveAttribute("srcset", "/a.jpg 800w, /b.jpg 1600w");
    expect(img).toHaveAttribute("sizes", "(min-width: 60rem) 50rem, 100%");
  });

  it("shows the blurred preview over the placeholder colour while loading, and keeps it under the picture once loaded", () => {
    const onLoad = vi.fn();
    const { container } = render(<Image {...PHOTO} placeholder={TINY} placeholderColor="var(--C-SURFACE-2)" onLoad={onLoad} />);
    const fill = container.querySelector<HTMLElement>(".r-media-image-placeholder")!;
    expect(fill).toHaveAttribute("aria-hidden", "true");
    expect(fill.style.backgroundColor).toBe("var(--C-SURFACE-2)");
    const preview = fill.querySelector("img")!;
    expect(preview).toHaveAttribute("src", TINY);
    expect(preview).toHaveAttribute("alt", "");
    expect(preview).toHaveClass("r-media-image-blur");

    fireEvent.load(picture(container)!);
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(root(container)).toHaveAttribute("data-state", "loaded");
    expect(root(container)).not.toHaveAttribute("aria-busy");
    // Still mounted: the stylesheet fades it out after the picture has faded in.
    expect(container.querySelector(".r-media-image-placeholder")).not.toBeNull();
  });

  it("a failed picture becomes a glyph and its alt text, still named by alt; a new src tries again", () => {
    const onError = vi.fn();
    const { container, rerender } = render(<Image {...PHOTO} onError={onError} />);
    fireEvent.error(picture(container)!);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(root(container)).toHaveAttribute("data-state", "error");
    expect(picture(container)).toBeNull();
    expect(container.querySelector(".r-media-image-placeholder")).toBeNull();
    const fallback = screen.getByRole("img", { name: "Dunes at first light" });
    expect(fallback).toHaveClass("r-media-image-fallback");
    expect(fallback).toHaveTextContent("Dunes at first light");

    rerender(<Image {...PHOTO} src="/photos/dunes-2.jpg" onError={onError} />);
    expect(root(container)).toHaveAttribute("data-state", "loading");
    expect(picture(container)).toHaveAttribute("src", "/photos/dunes-2.jpg");
    expect(container.querySelector(".r-media-image-fallback")).toBeNull();
  });

  it("decorative (alt=\"\"): hidden from assistive tech, and its fallback is the glyph alone", () => {
    const { container } = render(<Image {...PHOTO} alt="" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(picture(container)).toHaveAttribute("alt", "");
    fireEvent.error(picture(container)!);
    const fallback = container.querySelector(".r-media-image-fallback")!;
    expect(fallback).toHaveAttribute("aria-hidden", "true");
    expect(fallback).not.toHaveAttribute("role");
    expect(fallback.textContent).toBe("");
    expect(fallback.querySelector("svg")).not.toBeNull();
  });

  it("src null: the box waits busy with its placeholder, requests nothing, and answers for the picture", () => {
    const { container, rerender } = render(<Image {...PHOTO} src={null} placeholder={TINY} />);
    expect(root(container)).toHaveAttribute("data-state", "pending");
    expect(root(container)).toHaveAttribute("aria-busy", "true");
    expect(picture(container)).toBeNull();
    expect([...container.querySelectorAll("img")].map((img) => img.getAttribute("src"))).toEqual([TINY]);
    expect(screen.getByRole("img", { name: "Dunes at first light" })).toBeInTheDocument();

    rerender(<Image {...PHOTO} placeholder={TINY} />);
    expect(root(container)).toHaveAttribute("data-state", "loading");
    expect(screen.getAllByRole("img", { name: "Dunes at first light" })).toEqual([picture(container)]);
  });

  it("an empty, blank or missing src is a failure: the fallback shows its words and nothing is requested", () => {
    const { container, rerender } = render(<Image {...PHOTO} src="" />);
    for (const src of ["", "   ", undefined as unknown as string]) {
      rerender(<Image {...PHOTO} src={src} />);
      expect(root(container)).toHaveAttribute("data-state", "error");
      expect(root(container)).not.toHaveAttribute("aria-busy");
      expect(container.querySelectorAll("img")).toHaveLength(0);
      expect(screen.getByRole("img", { name: "Dunes at first light" })).toHaveClass("r-media-image-fallback");
    }

    rerender(<Image {...PHOTO} />);
    expect(root(container)).toHaveAttribute("data-state", "loading");
    expect(picture(container)).toHaveAttribute("src", PHOTO.src);
  });

  describe("a picture already complete when it mounts (cached, or loaded before hydration)", () => {
    afterEach(() => {
      delete (HTMLImageElement.prototype as unknown as Record<string, unknown>).complete;
      delete (HTMLImageElement.prototype as unknown as Record<string, unknown>).naturalWidth;
    });
    const stub = (complete: boolean, naturalWidth: number) => {
      Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => complete });
      Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", { configurable: true, get: () => naturalWidth });
    };

    it("is shown as loaded without waiting for a load event", () => {
      stub(true, 1600);
      const { container } = render(<Image {...PHOTO} />);
      expect(root(container)).toHaveAttribute("data-state", "loaded");
    });

    it("but one still on its way (not complete, or complete with no pixels) keeps loading", () => {
      stub(true, 0);
      const { container } = render(<Image {...PHOTO} />);
      expect(root(container)).toHaveAttribute("data-state", "loading");
    });
  });

  it("ratio, fit and radius map to their utilities; the caller's className wins a conflict and keeps the rest", () => {
    const { container, rerender } = render(<Image {...PHOTO} />);
    const box = root(container);
    expect(box).toHaveClass("r-media-image", "rounded-md");
    expect(box.className).not.toMatch(/\baspect-/);
    expect(picture(container)).toHaveClass("object-cover");

    rerender(<Image {...PHOTO} ratio="square" fit="contain" radius="none" />);
    expect(box).toHaveClass("aspect-square", "rounded-none");
    expect(picture(container)).toHaveClass("object-contain");

    rerender(<Image {...PHOTO} ratio="fill" />);
    expect(box).toHaveClass("size-full", "aspect-auto");

    rerender(<Image {...PHOTO} radius="sm" className="rounded-xl w-full" />);
    expect(box).toHaveClass("rounded-xl", "w-full", "r-media-image");
    expect(box).not.toHaveClass("rounded-sm");
  });

  it("the caller's style merges with the sizing variables", () => {
    const { container } = render(<Image {...PHOTO} style={{ marginInline: "auto" }} />);
    const box = root(container);
    expect(box.style.marginInline).toBe("auto");
    expect(box.style.getPropertyValue("--r-media-image-w")).toBe("1600");
  });
});
